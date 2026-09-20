import type {
	Catalog,
	DecisionResponse,
	Policy,
	ReceiptDetail,
	ReviewDetail,
} from "./types.ts";

const policies: Policy[] = [
	{
		id: "policy-release-ops",
		name: "Release operations",
		description:
			"Read the release workspace freely. Require review before any public communication or write to production release records.",
		tool_patterns: ["github.*", "slack.post_message"],
		allowed_effects: ["read", "write", "communicate", "network"],
		review_effects: ["write", "communicate"],
		review_tools: ["github.create_release"],
		resource_prefixes: ["repo:amajorai/ryu", "channel:#releases"],
		limits: { max_nodes: 24, max_depth: 6, max_bytes: 65_536 },
		allow_parallel_reads: true,
		bound_agent_ids: ["agent-release"],
		version: 7,
		hash: "sha256:4ee827ac4f1aad64af34398e40ae10c95fbdab8bb742fef2df8e8ec91a19ae4c",
		updated_at: "2026-08-22T06:40:00.000Z",
	},
	{
		id: "policy-local-research",
		name: "Local research",
		description:
			"Read-only local research. Network, writes, deletes, and messages stay denied.",
		tool_patterns: ["filesystem.*", "search.query"],
		allowed_effects: ["read"],
		review_effects: [],
		review_tools: [],
		resource_prefixes: ["workspace:D:/Code/ryu", "index:public-docs"],
		limits: { max_nodes: 64, max_depth: 8, max_bytes: 131_072 },
		allow_parallel_reads: true,
		bound_agent_ids: ["agent-research"],
		version: 3,
		hash: "sha256:33aaee3d9423a0b004b6244d85b31bd2f5021d442c36b58c537dbba6c032f842",
		updated_at: "2026-08-21T12:05:00.000Z",
	},
];

const review: ReviewDetail = {
	id: "review-release-0142",
	title: "Publish v0.1.14 and notify release channel",
	status: "pending",
	created_at: "2026-08-22T07:12:30.000Z",
	policy_name: "Release operations",
	node_count: 8,
	review_reason: "The plan contains public write and communication effects.",
	plan: {
		id: "root",
		kind: "sequence",
		title: "Verify, publish, then announce",
		children: [
			{
				id: "read-current-state",
				kind: "parallel",
				title: "Read independent release evidence",
				children: [
					{
						id: "read-checks",
						kind: "call",
						tool: "github.get_checks",
						title: "Read required checks",
						effects: ["read", "network"],
						resources: ["repo:amajorai/ryu", "ref:v0.1.14"],
						arguments: {
							kind: "literal",
							value: "[redacted by Core]",
						},
						arguments_hash:
							"sha256:b1ba90ae011d688896a831c6395bd69d8a9b95c95aaf4ec35522cf2863f7dace",
					},
					{
						id: "read-tag",
						kind: "call",
						tool: "github.get_tag",
						title: "Read signed tag",
						effects: ["read", "network"],
						resources: ["repo:amajorai/ryu", "tag:v0.1.14"],
						arguments: {
							kind: "literal",
							value: "[redacted by Core]",
						},
						arguments_hash:
							"sha256:9d5dc095b33d50be9dfc22d64e7467e134715d824352077a9d6922f62a733cb2",
					},
				],
			},
			{
				id: "checks-pass",
				kind: "if",
				title: "Continue only when every required check passes",
				condition: {
					source: "read-checks.output.required_passed",
					operator: "eq",
					value: true,
					description: "required_passed equals true",
				},
				// biome-ignore lint/suspicious/noThenProperty: `then` is fixed by the serialized finite plan DSL.
				then: {
					id: "publish-and-announce",
					kind: "sequence",
					title: "Publish the immutable release, then announce it",
					children: [
						{
							id: "publish-release",
							kind: "call",
							tool: "github.create_release",
							title: "Create public release",
							effects: ["write", "network"],
							resources: ["repo:amajorai/ryu", "tag:v0.1.14"],
							arguments: {
								kind: "literal",
								value: "[redacted by Core]",
							},
							arguments_hash:
								"sha256:62d1d2dfb76fa25d5e5887ad84ddda8b58de68104d6a08b27e5cf6220634477c",
						},
						{
							id: "announce-release",
							kind: "call",
							tool: "slack.post_message",
							title: "Notify the release channel",
							effects: ["communicate", "network"],
							resources: ["channel:#releases"],
							arguments: {
								kind: "literal",
								value: "[redacted by Core]",
							},
							arguments_hash:
								"sha256:3e7bdff76f9abc74c2635ccb42ce854af87a2cc90a2baab02a7a6c1fb747041d",
						},
					],
				},
			},
		],
	},
	findings: [
		{
			id: "finding-review-write",
			code: "effect_requires_review",
			severity: "review",
			title: "Public release requires a reviewer",
			message:
				"github.create_release carries the write effect. The policy allows it only after an authorized human approves this exact certificate.",
			node_id: "publish-release",
			counterexample:
				"Without a review decision, a valid execution prefix reaches publish-release while no approval fact exists.",
		},
		{
			id: "finding-review-message",
			code: "effect_requires_review",
			severity: "review",
			title: "External message requires a reviewer",
			message:
				"slack.post_message carries the communicate effect and targets an allowed channel prefix.",
			node_id: "announce-release",
		},
		{
			id: "finding-parallel-safe",
			code: "parallel_reads_disjoint",
			severity: "info",
			title: "Parallel branch is read-only",
			message:
				"Both branches contain only read/network effects. No branch can observe another branch's write.",
			node_id: "read-current-state",
		},
	],
	proof: {
		plan_hash:
			"sha256:1f60c5e0c208c25ab42f3d35a99757623009c09c1b645450b69428afc63f9e91",
		policy_hash: policies[0]?.hash,
		catalog_hash:
			"sha256:ec66a15063316042dca5e22ab84695689fde108cf1a4eb7c7e18976d8978ecf2",
		verifier_hash:
			"sha256:70d9c20adfd14c8c2c47e8a87ef3ec5647399abf283cf017c407610548ac4939",
		certificate_hash:
			"sha256:ca2f068d53dd3f93507869ba54894cb7b02cbd6028336281b8357c0757a0e500",
	},
	certificate: {
		plan_hash:
			"sha256:1f60c5e0c208c25ab42f3d35a99757623009c09c1b645450b69428afc63f9e91",
		policy_hash: policies[0]?.hash,
		catalog_hash:
			"sha256:ec66a15063316042dca5e22ab84695689fde108cf1a4eb7c7e18976d8978ecf2",
		verifier_hash:
			"sha256:70d9c20adfd14c8c2c47e8a87ef3ec5647399abf283cf017c407610548ac4939",
		certificate_hash:
			"sha256:ca2f068d53dd3f93507869ba54894cb7b02cbd6028336281b8357c0757a0e500",
		expires_at: "2026-08-22T08:12:30.000Z",
		algorithm: "sha256",
	},
	policy: policies[0],
};

const receipts: ReceiptDetail[] = [
	{
		id: "receipt-0141",
		title: "Refresh public release notes",
		status: "succeeded",
		started_at: "2026-08-22T06:51:12.150Z",
		finished_at: "2026-08-22T06:51:14.930Z",
		policy_name: "Release operations",
		policy_id: "policy-release-ops",
		tool_count: 3,
		steps: [
			{
				id: "receipt-step-1",
				index: 1,
				tool: "github.get_tag",
				status: "succeeded",
				started_at: "2026-08-22T06:51:12.150Z",
				finished_at: "2026-08-22T06:51:12.684Z",
				arguments_hash:
					"sha256:9d5dc095b33d50be9dfc22d64e7467e134715d824352077a9d6922f62a733cb2",
				result_hash:
					"sha256:e0a4a130a78033283b35de4fc57f0be31cad86c5a174512c67b1ec85c2522412",
				resources: ["repo:amajorai/ryu", "tag:v0.1.14"],
			},
			{
				id: "receipt-step-2",
				index: 2,
				tool: "github.create_release",
				status: "succeeded",
				started_at: "2026-08-22T06:51:12.721Z",
				finished_at: "2026-08-22T06:51:14.218Z",
				arguments_hash:
					"sha256:62d1d2dfb76fa25d5e5887ad84ddda8b58de68104d6a08b27e5cf6220634477c",
				result_hash:
					"sha256:47a5fca3c4b0b64ca9c434230a9e98ee969a1a384e3f4e5509f1414c43d3e4b1",
				resources: ["repo:amajorai/ryu", "tag:v0.1.14"],
			},
			{
				id: "receipt-step-3",
				index: 3,
				tool: "slack.post_message",
				status: "succeeded",
				started_at: "2026-08-22T06:51:14.231Z",
				finished_at: "2026-08-22T06:51:14.930Z",
				arguments_hash:
					"sha256:3e7bdff76f9abc74c2635ccb42ce854af87a2cc90a2baab02a7a6c1fb747041d",
				result_hash:
					"sha256:27173d35ac6ccf6357b99fa0015690c68ef0d4e88268266630b5509e96b3a5ef",
				resources: ["channel:#releases"],
			},
		],
		proof: review.proof,
	},
	{
		id: "receipt-0140",
		title: "Rotate staging deployment marker",
		status: "uncertain",
		started_at: "2026-08-22T03:19:00.000Z",
		finished_at: "2026-08-22T03:19:01.204Z",
		policy_name: "Release operations",
		policy_id: "policy-release-ops",
		tool_count: 1,
		uncertain_after_crash: true,
		error:
			"Core restarted after dispatch and before a durable result was recorded. The tool may have completed; automatic replay is disabled.",
		steps: [
			{
				id: "receipt-uncertain-1",
				index: 1,
				tool: "deployment.update_marker",
				status: "uncertain",
				started_at: "2026-08-22T03:19:00.000Z",
				finished_at: "2026-08-22T03:19:01.204Z",
				arguments_hash:
					"sha256:0916cfd991bdc6402343c329248669912026261127994b69ba9a9d2fa9055551",
				resources: ["deployment:staging"],
				error: "Result missing after process crash; intervention required.",
			},
		],
		proof: {
			plan_hash:
				"sha256:7339443438b6541b8bba686a2125e2f72276bd272884d5a36d70cdbe26b73f45",
			policy_hash: policies[0]?.hash,
			catalog_hash:
				"sha256:ec66a15063316042dca5e22ab84695689fde108cf1a4eb7c7e18976d8978ecf2",
			verifier_hash:
				"sha256:70d9c20adfd14c8c2c47e8a87ef3ec5647399abf283cf017c407610548ac4939",
			certificate_hash:
				"sha256:b3a67f8f440e07df2272178846978850ef4cfcc2e66034c0094321264641881c",
		},
	},
];

const catalog: Catalog = {
	hash: review.proof?.catalog_hash,
	tools: [
		{
			name: "github.get_checks",
			effects: ["read", "network"],
			resources: ["repo:amajorai/ryu"],
			trust: "operator_attested",
			schema_hash: "sha256:catalog-checks",
			arguments_independent: true,
		},
		{
			name: "github.get_tag",
			effects: ["read", "network"],
			resources: ["repo:amajorai/ryu"],
			trust: "operator_attested",
			schema_hash: "sha256:catalog-tag",
			arguments_independent: true,
		},
		{
			name: "github.create_release",
			effects: ["write", "network"],
			resources: ["repo:amajorai/ryu"],
			trust: "operator_attested",
			schema_hash: "sha256:catalog-release",
			arguments_independent: true,
		},
		{
			name: "slack.post_message",
			effects: ["communicate", "network"],
			resources: ["channel:#releases"],
			trust: "operator_attested",
			schema_hash: "sha256:catalog-message",
			arguments_independent: true,
		},
	],
};

function clone<T>(value: T): T {
	return structuredClone(value);
}

const initialPolicies = clone(policies);
const initialReview = clone(review);
const initialReceipts = clone(receipts);
const initialCatalog = clone(catalog);

function idFromPath(path: string, prefix: string): string | undefined {
	const match = path.match(new RegExp(`^/${prefix}/([^/?]+)`));
	return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

export async function proofFixtureRequest(input: {
	method?: "GET" | "POST" | "PUT" | "DELETE";
	path: string;
	body?: unknown;
}): Promise<unknown> {
	const method = input.method ?? "GET";
	if (method === "GET" && input.path === "/policies") {
		return { policies: clone(policies) };
	}
	if (method === "POST" && input.path === "/policies") {
		const body = input.body as Record<string, unknown>;
		const core = body.policy as Record<string, unknown>;
		const limits = core.limits as Record<string, number>;
		const next: Policy = {
			id: String(body.id ?? ""),
			name: String(body.name ?? "Untitled policy"),
			description:
				typeof body.description === "string" ? body.description : undefined,
			tool_patterns: clone((core.allow_tools ?? []) as string[]),
			deny_tool_patterns: clone((core.deny_tools ?? []) as string[]),
			allowed_effects: clone(
				(core.allowed_effects ?? []) as Policy["allowed_effects"]
			),
			review_effects: clone(
				(core.review_effects ?? []) as Policy["review_effects"]
			),
			review_tools: clone((core.review_tools ?? []) as string[]),
			resource_prefixes: clone((core.allowed_resources ?? []) as string[]),
			limits: {
				max_nodes: limits.max_nodes ?? 32,
				max_depth: limits.max_depth ?? 8,
				max_bytes: limits.max_plan_bytes ?? 65_536,
			},
			allow_parallel_reads: Boolean(core.allow_parallel_reads),
			bound_agent_ids: clone((body.bound_agent_ids ?? []) as string[]),
		};
		next.id = next.id || `policy-proof-${policies.length + 1}`;
		next.version = 1;
		policies.unshift(next);
		return { policy: clone(next) };
	}
	const policyId = idFromPath(input.path, "policies");
	if (policyId) {
		const index = policies.findIndex((policy) => policy.id === policyId);
		if (index < 0) {
			throw new Error("Fixture policy not found.");
		}
		const current = policies[index];
		if (!current) {
			throw new Error("Fixture policy not found.");
		}
		if (method === "GET") {
			return { policy: clone(current) };
		}
		if (method === "PUT") {
			const body = input.body as Record<string, unknown>;
			const core = body.policy as Record<string, unknown>;
			const limits = core.limits as Record<string, number>;
			const next: Policy = {
				...current,
				id: policyId,
				name: String(body.name ?? current.name),
				description:
					typeof body.description === "string" ? body.description : undefined,
				tool_patterns: clone((core.allow_tools ?? []) as string[]),
				deny_tool_patterns: clone((core.deny_tools ?? []) as string[]),
				allowed_effects: clone(
					(core.allowed_effects ?? []) as Policy["allowed_effects"]
				),
				review_effects: clone(
					(core.review_effects ?? []) as Policy["review_effects"]
				),
				review_tools: clone((core.review_tools ?? []) as string[]),
				resource_prefixes: clone((core.allowed_resources ?? []) as string[]),
				limits: {
					max_nodes: limits.max_nodes ?? current.limits.max_nodes,
					max_depth: limits.max_depth ?? current.limits.max_depth,
					max_bytes: limits.max_plan_bytes ?? current.limits.max_bytes,
				},
				allow_parallel_reads: Boolean(core.allow_parallel_reads),
				bound_agent_ids: clone((body.bound_agent_ids ?? []) as string[]),
				version: (current.version ?? 0) + 1,
			};
			policies[index] = next;
			return { policy: clone(next) };
		}
		if (method === "DELETE") {
			policies.splice(index, 1);
			return { deleted: true };
		}
		if (method === "POST" && input.path.endsWith("/check")) {
			return { valid: true, findings: [], summary: "Policy is consistent." };
		}
	}
	if (method === "GET" && input.path === "/catalog") {
		return clone(catalog);
	}
	if (method === "GET" && input.path === "/agents") {
		return {
			agents: [
				{
					id: "agent-release",
					name: "Release operator",
					title: "Verified plan only",
				},
				{
					id: "agent-research",
					name: "Research operator",
					title: "Verified plan only",
				},
			],
		};
	}
	if (method === "POST" && input.path === "/catalog/contracts") {
		const body = input.body as {
			contract: {
				arguments_independent: boolean;
				effects: Catalog["tools"][number]["effects"];
				resource_bindings: Array<{ pointer: string; prefix: string }>;
				resources: string[];
				trust: string;
			};
			tool: string;
		};
		const tool = catalog.tools.find((item) => item.name === body.tool);
		if (!tool) {
			throw new Error("Fixture tool not found.");
		}
		tool.effects = clone(body.contract.effects ?? []);
		tool.resources = clone(body.contract.resources);
		tool.trust = body.contract.trust;
		tool.arguments_independent = body.contract.arguments_independent;
		tool.resource_bindings = clone(body.contract.resource_bindings);
		return { contract: { tool: body.tool, ...clone(body.contract) } };
	}
	if (method === "GET" && input.path === "/reviews") {
		return { reviews: [clone(review)] };
	}
	const reviewId = idFromPath(input.path, "reviews");
	if (reviewId) {
		if (reviewId !== review.id) {
			throw new Error("Fixture review not found.");
		}
		if (method === "GET") {
			return { review: clone(review) };
		}
		const status = input.path.endsWith("/approve") ? "approved" : "denied";
		review.status = status;
		const decision: DecisionResponse = {
			status,
			message: input.path.endsWith("/approve")
				? "Approval recorded. Core will resume the persisted plan."
				: "Denial recorded. The persisted plan will not execute.",
		};
		return decision;
	}
	if (method === "GET" && input.path === "/receipts") {
		return { receipts: clone(receipts) };
	}
	const receiptId = idFromPath(input.path, "receipts");
	if (method === "GET" && receiptId) {
		const receipt = receipts.find((item) => item.id === receiptId);
		if (!receipt) {
			throw new Error("Fixture receipt not found.");
		}
		return { receipt: clone(receipt) };
	}
	throw new Error(`Proof fixture does not implement ${method} ${input.path}.`);
}

export function resetProofFixturesForTests(): void {
	policies.splice(0, policies.length, ...clone(initialPolicies));
	Object.assign(review, clone(initialReview));
	receipts.splice(0, receipts.length, ...clone(initialReceipts));
	Object.assign(catalog, clone(initialCatalog));
}
