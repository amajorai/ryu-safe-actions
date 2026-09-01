import type { Effect, PlanNode, Policy } from "./types.ts";

const EFFECTS: Effect[] = [
	"read",
	"write",
	"delete",
	"communicate",
	"spend",
	"network",
	"execute",
];

export const ALL_EFFECTS: readonly Effect[] = EFFECTS;

export interface FlatPlanNode {
	branch?: "then" | "else";
	depth: number;
	node: PlanNode;
	parentKind?: PlanNode["kind"];
	path: number[];
}

export function childrenOf(node: PlanNode): PlanNode[] {
	switch (node.kind) {
		case "sequence":
		case "parallel":
			return node.children;
		case "if":
			return node.else ? [node.then, node.else] : [node.then];
		default:
			return [];
	}
}

export function flattenPlan(root: PlanNode): FlatPlanNode[] {
	const result: FlatPlanNode[] = [];
	const visit = (
		node: PlanNode,
		depth: number,
		path: number[],
		parentKind?: PlanNode["kind"],
		branch?: "then" | "else"
	) => {
		result.push({ node, depth, path, parentKind, branch });
		if (node.kind === "sequence" || node.kind === "parallel") {
			for (const [index, child] of node.children.entries()) {
				visit(child, depth + 1, [...path, index], node.kind);
			}
		} else if (node.kind === "if") {
			visit(node.then, depth + 1, [...path, 0], node.kind, "then");
			if (node.else) {
				visit(node.else, depth + 1, [...path, 1], node.kind, "else");
			}
		}
	};
	visit(root, 0, []);
	return result;
}

export function countCalls(root: PlanNode): number {
	return flattenPlan(root).filter(({ node }) => node.kind === "call").length;
}

export function effectsOf(root: PlanNode): Effect[] {
	const found = new Set<Effect>();
	for (const { node } of flattenPlan(root)) {
		if (node.kind === "call") {
			for (const effect of node.effects) {
				found.add(effect);
			}
		}
	}
	return EFFECTS.filter((effect) => found.has(effect));
}

export function resourcesOf(root: PlanNode): string[] {
	const found = new Set<string>();
	for (const { node } of flattenPlan(root)) {
		if (node.kind === "call") {
			for (const resource of node.resources) {
				found.add(resource);
			}
		}
	}
	return [...found].sort();
}

export interface PolicyValidation {
	errors: string[];
	valid: boolean;
	warnings: string[];
}

const PATTERN = /^[A-Za-z0-9_@./:-]+(?:\.\*)?$/;

export function validatePolicy(policy: Policy): PolicyValidation {
	const errors: string[] = [];
	const warnings: string[] = [];
	if (!policy.name.trim()) {
		errors.push("Policy name is required.");
	}
	if (policy.tool_patterns.length === 0) {
		warnings.push("No tools are allowed. This policy denies every call.");
	}
	for (const pattern of policy.tool_patterns) {
		if (!PATTERN.test(pattern)) {
			errors.push(
				`Tool pattern “${pattern}” must be an exact name or end in a single trailing .*.`
			);
		}
		if (pattern === "*" || pattern.includes("**")) {
			errors.push(`Tool pattern “${pattern}” is too broad.`);
		}
	}
	for (const reviewTool of policy.review_tools) {
		if (!PATTERN.test(reviewTool)) {
			errors.push(`Review tool “${reviewTool}” is not a valid tool pattern.`);
		}
	}
	for (const prefix of policy.resource_prefixes) {
		const lowered = prefix.toLowerCase();
		if (
			!prefix.trim() ||
			prefix.includes("\\") ||
			lowered.includes("%2e") ||
			lowered.includes("%2f") ||
			lowered.includes("%5c") ||
			prefix.split("/").some((segment) => segment === "." || segment === "..")
		) {
			errors.push(`Resource prefix “${prefix}” is not a safe concrete prefix.`);
		}
	}
	if (
		!Number.isSafeInteger(policy.limits.max_nodes) ||
		policy.limits.max_nodes < 1 ||
		policy.limits.max_nodes > 4096
	) {
		errors.push("Maximum nodes must be a whole number between 1 and 4,096.");
	}
	if (
		!Number.isSafeInteger(policy.limits.max_depth) ||
		policy.limits.max_depth < 1 ||
		policy.limits.max_depth > 64
	) {
		errors.push("Maximum depth must be a whole number between 1 and 64.");
	}
	if (
		!Number.isSafeInteger(policy.limits.max_bytes) ||
		policy.limits.max_bytes < 1 ||
		policy.limits.max_bytes > 1_048_576
	) {
		errors.push(
			"Maximum bytes must be a whole number between 1 and 1,048,576."
		);
	}
	for (const effect of policy.review_effects) {
		if (!policy.allowed_effects.includes(effect)) {
			errors.push(`Review effect “${effect}” must also be allowed.`);
		}
	}
	if (policy.allowed_effects.length === 0) {
		warnings.push("No effects are allowed. This policy denies every call.");
	}
	if (!policy.allow_parallel_reads) {
		warnings.push("Parallel calls are disabled, including read-only branches.");
	}
	if ((policy.bound_agent_ids?.length ?? 0) === 0) {
		warnings.push(
			"No verified agents are bound. The policy is saved but not active."
		);
	}
	return { valid: errors.length === 0, errors, warnings };
}

export function policySummary(policy: Policy): string {
	const validation = validatePolicy(policy);
	if (!validation.valid) {
		return `${validation.errors.length} blocking ${validation.errors.length === 1 ? "error" : "errors"}`;
	}
	if (
		policy.tool_patterns.length === 0 ||
		policy.allowed_effects.length === 0
	) {
		return "Consistent · denies all calls";
	}
	const review =
		policy.review_effects.length + policy.review_tools.length > 0
			? `${policy.review_effects.length + policy.review_tools.length} review rules`
			: "no review rules";
	return `Consistent · default deny · ${review}`;
}

export function shortHash(value?: string): string {
	if (!value) {
		return "Not recorded";
	}
	return value.length > 20 ? `${value.slice(0, 12)}…${value.slice(-6)}` : value;
}

export function formatTime(value?: string): string {
	if (!value) {
		return "—";
	}
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function safeJson(value: unknown): string {
	return JSON.stringify(value, null, 2).replace(/[\u2028\u2029]/g, "");
}
