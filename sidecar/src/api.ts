import { proofFixtureRequest } from "./fixtures.ts";
import type {
	Catalog,
	CatalogTool,
	DecisionResponse,
	Effect,
	Finding,
	PlanNode,
	Policy,
	ProofHashes,
	ReceiptDetail,
	ReceiptStatus,
	ReceiptSummary,
	ReviewDetail,
	ReviewSummary,
	VerifiedAgent,
} from "./types.ts";

type Method = "GET" | "POST" | "PUT" | "DELETE";
type Requester = (input: {
	method?: Method;
	path: string;
	body?: unknown;
}) => Promise<unknown>;

interface CorePolicy {
	allow_parallel_reads?: boolean;
	allow_tools?: string[];
	allowed_effects?: string[];
	allowed_resources?: string[];
	deny_tools?: string[];
	limits?: { max_plan_bytes?: number; max_nodes?: number; max_depth?: number };
	review_effects?: string[];
	review_tools?: string[];
}

interface CorePolicyRecord {
	bound_agent_ids?: string[];
	description?: string;
	id: string;
	name: string;
	policy: CorePolicy;
	policy_hash?: string;
	updated_at?: string;
	version?: number;
}

interface CoreContract {
	arguments_independent?: boolean;
	effects?: string[];
	resource_bindings?: Array<{ pointer?: string; prefix?: string }>;
	resources?: string[];
	trust?: string;
}

interface CoreToolDescriptor {
	attested_by?: string;
	contract?: CoreContract | null;
	contract_hash?: string;
	contract_implementation_hash?: string;
	contract_stale?: boolean;
	implementation_hash?: string;
	input_schema?: unknown;
	name: string;
}

interface CoreAgent {
	id?: string;
	name?: string;
	title?: string;
}

interface CorePlanNode {
	arguments?: unknown;
	arguments_redacted?: boolean;
	else_node?: CorePlanNode;
	id: string;
	kind: "call" | "sequence" | "parallel" | "if";
	nodes?: CorePlanNode[];
	predicate?: unknown;
	then_node?: CorePlanNode;
	tool?: string;
}

interface CoreFinding {
	code?: string;
	message?: string;
	node_id?: string;
	severity?: string;
}

interface CoreCounterexample {
	effect?: string;
	node_id?: string;
	reason?: string;
	resource?: string;
	tool?: string;
}

interface CoreBindings {
	catalog_hash?: string;
	plan_hash?: string;
	policy_hash?: string;
	verifier_version?: string;
}

interface CoreCertificate {
	data?: {
		bindings?: CoreBindings;
		expires_at_unix_ms?: number;
	};
	integrity_hash?: string;
}

interface CoreSubmission {
	agent_id?: string;
	certificate?: CoreCertificate | null;
	created_at?: string;
	id: string;
	plan?: { root?: CorePlanNode };
	policy_id?: string;
	report?: {
		decision?: string;
		bindings?: CoreBindings;
		findings?: CoreFinding[];
		counterexamples?: CoreCounterexample[];
		argument_hashes?: Record<string, string>;
		invocation_resources?: Record<string, string[]>;
		node_count?: number;
	};
	status?: string;
}

interface CoreStepReceipt {
	arguments_hash?: string;
	error?: string;
	finished_at?: string;
	ordinal?: number;
	result_hash?: string;
	started_at?: string;
	status?: string;
	step_id?: string;
	tool?: string;
}

interface CoreReceipt {
	catalog_hash?: string;
	error?: string;
	finished_at?: string;
	id: string;
	plan_hash?: string;
	policy_hash?: string;
	started_at?: string;
	status?: string;
	steps?: CoreStepReceipt[];
	submission_id?: string;
	verifier_version?: string;
}

let testRequester: Requester | undefined;

export function isProofFixtureMode(search?: string): boolean {
	const value =
		search ?? (typeof window === "undefined" ? "" : window.location.search);
	const enabled =
		import.meta.env.DEV || import.meta.env.VITE_SAFE_ACTIONS_PROOF === "1";
	return enabled && new URLSearchParams(value).get("proof") === "1";
}

export function setRequesterForTests(requester?: Requester): void {
	testRequester = requester;
}

function bridgeRequester(): Requester {
	if (testRequester) {
		return testRequester;
	}
	if (isProofFixtureMode()) {
		return proofFixtureRequest;
	}
	const bridge =
		typeof window === "undefined" ? undefined : window.ryu?.safeActions;
	if (!bridge) {
		throw new Error(
			"Safe Actions is not connected to Core. Open this Companion from Ryu with the safe-actions:manage grant. Demo data is never shown in production mode."
		);
	}
	return bridge.request.bind(bridge);
}

function assertSafePath(path: string): void {
	if (
		!path.startsWith("/") ||
		path.startsWith("//") ||
		path.includes("://") ||
		path.split(/[/?]/).includes("..")
	) {
		throw new Error(
			"Refusing a Safe Actions request outside its fixed API mount."
		);
	}
}

export async function requestApi<T>(
	path: string,
	method: Method = "GET",
	body?: unknown
): Promise<T> {
	assertSafePath(path);
	return (await bridgeRequester()({ method, path, body })) as T;
}

function segment(id: string): string {
	return encodeURIComponent(id);
}

function unwrap(value: unknown, key: string): unknown {
	if (value && typeof value === "object" && key in value) {
		return (value as Record<string, unknown>)[key];
	}
	return value;
}

function unwrapList(value: unknown, key: string): unknown[] {
	const unwrapped = unwrap(value, key);
	if (!Array.isArray(unwrapped)) {
		throw new Error(`Core returned an invalid ${key} list.`);
	}
	return unwrapped;
}

function isPresentationPolicy(value: unknown): value is Policy {
	return Boolean(
		value &&
			typeof value === "object" &&
			"tool_patterns" in value &&
			"limits" in value
	);
}

const EFFECTS = new Set<Effect>([
	"read",
	"write",
	"delete",
	"communicate",
	"spend",
	"network",
	"execute",
]);

function effect(value: string): Effect | undefined {
	return EFFECTS.has(value as Effect) ? (value as Effect) : undefined;
}

function effects(values: string[] = []): Effect[] {
	return values.map(effect).filter((value): value is Effect => Boolean(value));
}

export function adaptPolicy(value: unknown): Policy {
	if (isPresentationPolicy(value)) {
		return value;
	}
	const record = value as CorePolicyRecord;
	const policy = record.policy ?? {};
	return {
		id: record.id ?? "",
		name: record.name ?? "Untitled policy",
		description: record.description,
		tool_patterns: policy.allow_tools ?? [],
		deny_tool_patterns: policy.deny_tools ?? [],
		allowed_effects: effects(policy.allowed_effects),
		review_effects: effects(policy.review_effects),
		review_tools: policy.review_tools ?? [],
		resource_prefixes: policy.allowed_resources ?? [],
		limits: {
			max_nodes: policy.limits?.max_nodes ?? 128,
			max_depth: policy.limits?.max_depth ?? 16,
			max_bytes: policy.limits?.max_plan_bytes ?? 65_536,
		},
		allow_parallel_reads: policy.allow_parallel_reads ?? false,
		version: record.version,
		hash: record.policy_hash,
		bound_agent_ids: record.bound_agent_ids ?? [],
		updated_at: record.updated_at,
	};
}

export function policyInput(policy: Policy): Record<string, unknown> {
	return {
		...(policy.id ? { id: policy.id } : {}),
		name: policy.name,
		description: policy.description?.trim() || undefined,
		policy: {
			allow_tools: policy.tool_patterns,
			deny_tools: policy.deny_tool_patterns ?? [],
			allowed_effects: policy.allowed_effects,
			allowed_resources: policy.resource_prefixes,
			review_tools: policy.review_tools,
			review_effects: policy.review_effects,
			allow_parallel_reads: policy.allow_parallel_reads,
			limits: {
				max_plan_bytes: policy.limits.max_bytes,
				max_nodes: policy.limits.max_nodes,
				max_depth: policy.limits.max_depth,
			},
		},
		bound_agent_ids: policy.bound_agent_ids ?? [],
		expected_version: policy.version,
	};
}

function adaptTool(value: unknown): CatalogTool {
	const tool = value as CoreToolDescriptor;
	if (tool && "effects" in tool && !("contract" in tool)) {
		return value as CatalogTool;
	}
	return {
		name: tool.name,
		attested_by: tool.attested_by,
		contract_hash: tool.contract_hash,
		contract_implementation_hash: tool.contract_implementation_hash,
		contract_stale: tool.contract_stale,
		description: tool.contract?.trust
			? `${tool.contract.trust.replaceAll("_", " ")} effect contract`
			: "Missing effect contract",
		effects: effects(tool.contract?.effects),
		resources: tool.contract?.resources ?? [],
		trust: tool.contract?.trust,
		input_schema: tool.input_schema,
		implementation_hash: tool.implementation_hash,
		resource_bindings: (tool.contract?.resource_bindings ?? []).flatMap(
			(binding) =>
				typeof binding.pointer === "string" &&
				typeof binding.prefix === "string"
					? [{ pointer: binding.pointer, prefix: binding.prefix }]
					: []
		),
		arguments_independent: tool.contract?.arguments_independent,
	};
}

export function adaptCatalog(value: unknown): Catalog {
	const raw = unwrap(value, "catalog") as {
		tools?: unknown[];
		catalog_hash?: string;
		hash?: string;
	};
	if (!(raw && Array.isArray(raw.tools))) {
		throw new Error("Core returned an invalid tool catalog.");
	}
	return {
		hash: raw?.catalog_hash ?? raw?.hash,
		tools: raw.tools.map(adaptTool),
	};
}

function describePredicate(value: unknown): string {
	if (!(value && typeof value === "object")) {
		return "Typed predicate";
	}
	const predicate = value as Record<string, unknown>;
	const kind =
		typeof predicate.kind === "string" ? predicate.kind : "predicate";
	return kind === "compare"
		? `Compare typed values (${String(predicate.op ?? "equal")})`
		: `${kind.replaceAll("_", " ")} predicate`;
}

function adaptPlanNode(
	value: CorePlanNode,
	catalog: Map<string, CatalogTool>,
	argumentHashes: Record<string, string>,
	invocationResources: Record<string, string[]>
): PlanNode {
	if (value.kind === "call") {
		const descriptor = catalog.get(value.tool ?? "");
		return {
			id: value.id,
			kind: "call",
			tool: value.tool ?? "unknown-tool",
			title: value.tool ?? "Unknown tool",
			effects: descriptor?.effects ?? [],
			arguments:
				value.arguments_redacted === true
					? value.arguments
					: { marker: "[Core-redacted argument structure unavailable]" },
			arguments_hash: argumentHashes[value.id],
			resources: invocationResources[value.id] ?? [],
		};
	}
	if (value.kind === "if") {
		return {
			id: value.id,
			kind: "if",
			title: "Conditional branch",
			condition: { description: describePredicate(value.predicate) },
			// biome-ignore lint/suspicious/noThenProperty: `then` is fixed by the serialized finite plan DSL.
			then: value.then_node
				? adaptPlanNode(
						value.then_node,
						catalog,
						argumentHashes,
						invocationResources
					)
				: { id: `${value.id}-missing-then`, kind: "sequence", children: [] },
			else: value.else_node
				? adaptPlanNode(
						value.else_node,
						catalog,
						argumentHashes,
						invocationResources
					)
				: undefined,
		};
	}
	return {
		id: value.id,
		kind: value.kind,
		title: value.kind === "parallel" ? "Parallel branch" : "Ordered steps",
		children: (value.nodes ?? []).map((node) =>
			adaptPlanNode(node, catalog, argumentHashes, invocationResources)
		),
	};
}

function presentationStatus(value?: string): ReviewSummary["status"] {
	switch (value) {
		case "pending_review":
			return "pending";
		case "denied_by_reviewer":
		case "denied":
			return "denied";
		case "approved":
			return "approved";
		case "executing":
			return "executing";
		case "certified":
		case "succeeded":
		case "uncertain":
		case "unknown_after_crash":
			return "closed";
		case "invalidated":
			return "expired";
		default:
			return "expired";
	}
}

function titleFromCode(code: string): string {
	return code
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

function adaptFinding(
	finding: CoreFinding,
	counterexamples: CoreCounterexample[]
): Finding {
	const counterexample = counterexamples.find(
		(item) => item.node_id && item.node_id === finding.node_id
	);
	const code = finding.code ?? "verification_finding";
	return {
		code,
		severity:
			finding.severity === "review"
				? "review"
				: finding.severity === "error"
					? "deny"
					: "info",
		title: titleFromCode(code),
		message: finding.message ?? "The verifier recorded a policy finding.",
		node_id: finding.node_id,
		counterexample: counterexample
			? {
					reason: counterexample.reason,
					tool: counterexample.tool,
					effect: counterexample.effect,
					resource: counterexample.resource,
				}
			: undefined,
	};
}

function hashesFromBindings(
	bindings?: CoreBindings,
	certificate?: CoreCertificate | null
): ProofHashes {
	const source = certificate?.data?.bindings ?? bindings;
	return {
		plan_hash: source?.plan_hash,
		policy_hash: source?.policy_hash,
		catalog_hash: source?.catalog_hash,
		verifier_hash: source?.verifier_version,
		certificate_hash: certificate?.integrity_hash,
	};
}

function isPresentationReview(value: unknown): value is ReviewDetail {
	return Boolean(
		value &&
			typeof value === "object" &&
			"title" in value &&
			"plan" in value &&
			(value as ReviewDetail).plan?.kind
	);
}

export function adaptReview(
	value: unknown,
	catalogValue?: unknown
): ReviewDetail {
	const catalog = adaptCatalog(catalogValue ?? { tools: [] });
	if (isPresentationReview(value)) {
		const boundCatalogHash = value.proof?.catalog_hash;
		const catalogMatches = Boolean(
			catalog.hash && boundCatalogHash && catalog.hash === boundCatalogHash
		);
		return {
			...value,
			catalog,
			reviewable: value.reviewable !== false && catalogMatches,
			review_block_reason: catalogMatches
				? value.review_block_reason
				: "The live tool catalog does not match the catalog bound into this review.",
		};
	}
	const record = value as CoreSubmission;
	const toolMap = new Map(catalog.tools.map((tool) => [tool.name, tool]));
	const counterexamples = record.report?.counterexamples ?? [];
	const proof = hashesFromBindings(record.report?.bindings, record.certificate);
	const expiresAt = record.certificate?.data?.expires_at_unix_ms;
	const missingProof = !(
		proof.plan_hash &&
		proof.policy_hash &&
		proof.catalog_hash &&
		proof.verifier_hash
	);
	const root = record.plan?.root;
	const catalogMatches = Boolean(
		catalog.hash && proof.catalog_hash && catalog.hash === proof.catalog_hash
	);
	const calls = root ? collectCoreCalls(root) : [];
	const argumentHashes = record.report?.argument_hashes ?? {};
	const invocationResources = record.report?.invocation_resources ?? {};
	const incompleteTool = calls.find((call) => {
		const descriptor = toolMap.get(call.tool ?? "");
		return !(
			descriptor?.trust &&
			descriptor.effects?.length &&
			"arguments" in call &&
			call.arguments_redacted === true &&
			argumentHashes[call.id] &&
			invocationResources[call.id]?.length
		);
	});
	const reviewable = Boolean(
		root && record.report && !missingProof && !incompleteTool && catalogMatches
	);
	return {
		id: record.id,
		title: `Plan from ${record.agent_id ?? "verified agent"}`,
		status: presentationStatus(record.status),
		created_at: record.created_at ?? "",
		policy_name: record.policy_id,
		node_count: record.report?.node_count,
		review_reason:
			record.report?.decision === "needs_review"
				? "The deterministic verifier proved the plan is within policy but found rules that require human judgment."
				: `Verifier decision: ${record.report?.decision ?? "unknown"}.`,
		plan: root
			? adaptPlanNode(root, toolMap, argumentHashes, invocationResources)
			: { id: "missing-plan", kind: "sequence", children: [] },
		findings: (record.report?.findings ?? []).map((finding) =>
			adaptFinding(finding, counterexamples)
		),
		proof,
		certificate: {
			...proof,
			expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
			algorithm: "sha256",
		},
		catalog,
		reviewable,
		review_block_reason: root
			? record.report
				? missingProof
					? "One or more proof bindings are missing."
					: incompleteTool
						? `Tool ${incompleteTool.tool ?? "unknown"} is missing a Core-redacted argument structure, a Core argument hash, or proved invocation resources.`
						: catalogMatches
							? undefined
							: "The live tool catalog does not match the catalog bound into this review."
				: "Core did not return the verifier report."
			: "Core did not return the persisted typed plan.",
	};
}

function collectCoreCalls(root: CorePlanNode): CorePlanNode[] {
	const calls: CorePlanNode[] = [];
	const visit = (node: CorePlanNode) => {
		if (node.kind === "call") {
			calls.push(node);
		}
		for (const child of node.nodes ?? []) {
			visit(child);
		}
		if (node.then_node) {
			visit(node.then_node);
		}
		if (node.else_node) {
			visit(node.else_node);
		}
	};
	visit(root);
	return calls;
}

function receiptStatus(value?: string): ReceiptStatus {
	switch (value) {
		case "completed":
		case "succeeded":
			return "succeeded";
		case "unknown_after_crash":
		case "uncertain":
			return "uncertain";
		case "running":
			return "running";
		case "denied":
			return "denied";
		case "queued":
			return "queued";
		default:
			return "failed";
	}
}

function isPresentationReceipt(value: unknown): value is ReceiptDetail {
	return Boolean(
		value && typeof value === "object" && "title" in value && "steps" in value
	);
}

export function adaptReceipt(value: unknown): ReceiptDetail {
	if (isPresentationReceipt(value)) {
		return value;
	}
	const receipt = value as CoreReceipt;
	const status = receiptStatus(receipt.status);
	return {
		id: receipt.id,
		title: `Execution ${receipt.submission_id ?? receipt.id}`,
		status,
		started_at: receipt.started_at ?? "",
		finished_at: receipt.finished_at,
		tool_count: receipt.steps?.length ?? 0,
		error: receipt.error,
		uncertain_after_crash: receipt.status === "unknown_after_crash",
		steps: (receipt.steps ?? []).map((step, index) => ({
			id: step.step_id ?? `${receipt.id}-step-${index + 1}`,
			index: step.ordinal ?? index + 1,
			tool: step.tool ?? "unknown-tool",
			status:
				step.status === "skipped" ? "skipped" : receiptStatus(step.status),
			started_at: step.started_at,
			finished_at: step.finished_at,
			arguments_hash: step.arguments_hash,
			result_hash: step.result_hash,
			error: step.error,
		})),
		proof: {
			plan_hash: receipt.plan_hash,
			policy_hash: receipt.policy_hash,
			catalog_hash: receipt.catalog_hash,
			verifier_hash: receipt.verifier_version,
		},
	};
}

export async function listPolicies(): Promise<Policy[]> {
	return unwrapList(await requestApi("/policies"), "policies").map(adaptPolicy);
}

export async function getPolicy(id: string): Promise<Policy> {
	return adaptPolicy(
		unwrap(await requestApi(`/policies/${segment(id)}`), "policy")
	);
}

export async function createPolicy(policy: Policy): Promise<Policy> {
	return adaptPolicy(
		unwrap(await requestApi("/policies", "POST", policyInput(policy)), "policy")
	);
}

export async function updatePolicy(policy: Policy): Promise<Policy> {
	return adaptPolicy(
		unwrap(
			await requestApi(
				`/policies/${segment(policy.id)}`,
				"PUT",
				policyInput(policy)
			),
			"policy"
		)
	);
}

export async function deletePolicy(
	id: string,
	expectedVersion: number
): Promise<{ deleted: boolean }> {
	const response = await requestApi<{ deleted?: boolean; ok?: boolean }>(
		`/policies/${segment(id)}`,
		"DELETE",
		{ expected_version: expectedVersion }
	);
	return { deleted: response.deleted ?? response.ok ?? false };
}

export function checkPolicy(
	id: string,
	input: { agent_id: string; plan: unknown }
): Promise<{ valid: boolean; findings?: unknown[]; summary?: string }> {
	return requestApi(`/policies/${segment(id)}/check`, "POST", input);
}

export async function getCatalog(): Promise<Catalog> {
	return adaptCatalog(await requestApi("/catalog"));
}

export async function listVerifiedAgents(): Promise<VerifiedAgent[]> {
	return unwrapList(await requestApi("/agents"), "agents").map((value) => {
		const agent = value as CoreAgent;
		if (!(agent.id && agent.name)) {
			throw new Error("Core returned an invalid verified agent record.");
		}
		return { id: agent.id, name: agent.name, title: agent.title };
	});
}

export function attestContract(input: {
	arguments_independent: boolean;
	effects: Effect[];
	expected_contract_hash?: string;
	expected_implementation_hash?: string;
	resource_bindings: Array<{ pointer: string; prefix: string }>;
	resources: string[];
	tool: string;
}): Promise<unknown> {
	return requestApi("/catalog/contracts", "POST", {
		tool: input.tool,
		expected_contract_hash: input.expected_contract_hash,
		expected_implementation_hash: input.expected_implementation_hash,
		contract: {
			trust: "operator_attested",
			effects: input.effects,
			resources: input.resources,
			resource_bindings: input.resource_bindings,
			arguments_independent: input.arguments_independent,
		},
	});
}

export async function listReviews(): Promise<ReviewSummary[]> {
	return unwrapList(await requestApi("/reviews"), "reviews").map((value) => {
		if (
			value &&
			typeof value === "object" &&
			"title" in value &&
			!("plan" in value)
		) {
			return value as ReviewSummary;
		}
		return adaptReview(value);
	});
}

export async function getReview(id: string): Promise<ReviewDetail> {
	const [reviewValue, catalogValue] = await Promise.all([
		requestApi(`/reviews/${segment(id)}`),
		requestApi("/catalog"),
	]);
	return adaptReview(unwrap(reviewValue, "review"), catalogValue);
}

export function decideReview(
	id: string,
	decision: "approve" | "deny",
	note?: string
): Promise<DecisionResponse> {
	return requestApi(`/reviews/${segment(id)}/${decision}`, "POST", {
		note: note?.trim() || undefined,
	});
}

export async function listReceipts(): Promise<ReceiptSummary[]> {
	return unwrapList(await requestApi("/receipts"), "receipts").map(
		adaptReceipt
	);
}

export async function getReceipt(id: string): Promise<ReceiptDetail> {
	return adaptReceipt(
		unwrap(await requestApi(`/receipts/${segment(id)}`), "receipt")
	);
}
