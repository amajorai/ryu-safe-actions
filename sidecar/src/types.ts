export type Effect =
	| "read"
	| "write"
	| "delete"
	| "communicate"
	| "spend"
	| "network"
	| "execute";

export interface VerifiedAgent {
	id: string;
	name: string;
	title?: string;
}

export type PlanNode = CallNode | SequenceNode | ParallelNode | IfNode;

export interface CallNode {
	argument_hash?: string;
	arguments?: unknown;
	arguments_hash?: string;
	effects: Effect[];
	id: string;
	kind: "call";
	resources: string[];
	title?: string;
	tool: string;
}

export interface SequenceNode {
	children: PlanNode[];
	id: string;
	kind: "sequence";
	title?: string;
}

export interface ParallelNode {
	children: PlanNode[];
	id: string;
	kind: "parallel";
	title?: string;
}

export interface IfNode {
	condition: {
		source?: string;
		operator?: string;
		value?: unknown;
		description?: string;
	};
	else?: PlanNode;
	id: string;
	kind: "if";
	then: PlanNode;
	title?: string;
}

export interface PolicyLimits {
	max_bytes: number;
	max_depth: number;
	max_nodes: number;
}

export interface Policy {
	allow_parallel_reads: boolean;
	allowed_effects: Effect[];
	bound_agent_ids?: string[];
	deny_tool_patterns?: string[];
	description?: string;
	hash?: string;
	id: string;
	limits: PolicyLimits;
	name: string;
	resource_prefixes: string[];
	review_effects: Effect[];
	review_tools: string[];
	tool_patterns: string[];
	updated_at?: string;
	version?: number;
}

export interface CatalogTool {
	arguments_independent?: boolean;
	attested_by?: string;
	contract_hash?: string;
	contract_implementation_hash?: string;
	contract_stale?: boolean;
	description?: string;
	effects?: Effect[];
	implementation_hash?: string;
	input_schema?: unknown;
	name: string;
	resource_bindings?: Array<{ pointer: string; prefix: string }>;
	resources?: string[];
	schema_hash?: string;
	trust?: string;
}

export interface Catalog {
	hash?: string;
	tools: CatalogTool[];
}

export type FindingSeverity = "info" | "review" | "deny";

export interface Finding {
	code: string;
	counterexample?: string | Record<string, unknown>;
	id?: string;
	message: string;
	node_id?: string;
	severity: FindingSeverity;
	title?: string;
}

export interface ProofHashes {
	catalog_hash?: string;
	certificate_hash?: string;
	plan_hash?: string;
	policy_hash?: string;
	verifier_hash?: string;
}

export interface ReviewSummary {
	created_at: string;
	id: string;
	node_count?: number;
	policy_name?: string;
	review_reason?: string;
	status:
		| "pending"
		| "approved"
		| "denied"
		| "executing"
		| "closed"
		| "expired";
	title: string;
}

export interface ReviewDetail extends ReviewSummary {
	catalog?: Catalog;
	certificate?: ProofHashes & { expires_at?: string; algorithm?: string };
	findings: Finding[];
	plan: PlanNode;
	policy?: Policy;
	proof?: ProofHashes;
	review_block_reason?: string;
	reviewable?: boolean;
}

export type ReceiptStatus =
	| "queued"
	| "running"
	| "succeeded"
	| "failed"
	| "denied"
	| "uncertain";

export interface ReceiptSummary {
	finished_at?: string;
	id: string;
	policy_name?: string;
	started_at: string;
	status: ReceiptStatus;
	title: string;
	tool_count?: number;
}

export interface ReceiptStep {
	argument_hash?: string;
	arguments_hash?: string;
	error?: string;
	finished_at?: string;
	id: string;
	index: number;
	resources?: string[];
	result_hash?: string;
	started_at?: string;
	status: ReceiptStatus | "skipped";
	tool: string;
}

export interface ReceiptDetail extends ReceiptSummary {
	certificate?: ProofHashes;
	error?: string;
	policy_id?: string;
	proof?: ProofHashes;
	steps: ReceiptStep[];
	uncertain_after_crash?: boolean;
}

export interface DecisionResponse {
	message?: string;
	review?: ReviewDetail;
	status?: string;
}
