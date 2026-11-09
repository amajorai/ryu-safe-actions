import { z } from "zod";
import type {
	CoreAgent,
	CoreBindings,
	CoreCertificate,
	CoreContract,
	CoreCounterexample,
	CoreFinding,
	CorePlanNode,
	CorePolicy,
	CorePolicyRecord,
	CoreReceipt,
	CoreStepReceipt,
	CoreSubmission,
	CoreToolDescriptor,
} from "./api.ts";
import type {
	CallNode,
	Catalog,
	CatalogTool,
	DecisionResponse,
	Effect,
	Finding,
	FindingSeverity,
	IfNode,
	ParallelNode,
	PlanNode,
	Policy,
	PolicyLimits,
	ProofHashes,
	ReceiptDetail,
	ReceiptStatus,
	ReceiptStep,
	ReceiptSummary,
	ReviewDetail,
	ReviewSummary,
	SequenceNode,
	VerifiedAgent,
} from "./types.ts";
import {
	safeActionsNumberSchema,
	safeActionsRequestValueSchema,
} from "./wire.ts";
export const PLAN_THEN_KEY = "then";
export const EffectSchema: z.ZodType<Effect> = z.lazy(() =>
	z.union([
		z.literal("read"),
		z.literal("write"),
		z.literal("delete"),
		z.literal("communicate"),
		z.literal("spend"),
		z.literal("network"),
		z.literal("execute"),
	])
);

const VerifiedAgentFields: z.ZodType<VerifiedAgent> = z.lazy(() =>
	z.looseObject({
		id: z.string(),
		name: z.string(),
		title: z.string().optional(),
	})
);
export const VerifiedAgentSchema = z.custom<VerifiedAgent>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		VerifiedAgentFields.safeParse(value).success
);

export const PlanNodeSchema: z.ZodType<PlanNode> = z.lazy(() =>
	z.union([
		CallNodeSchema,
		SequenceNodeSchema,
		ParallelNodeSchema,
		IfNodeSchema,
	])
);

const CallNodeFields: z.ZodType<CallNode> = z.lazy(() =>
	z.looseObject({
		argument_hash: z.string().optional(),
		arguments: safeActionsRequestValueSchema.optional(),
		arguments_hash: z.string().optional(),
		effects: z.array(EffectSchema),
		id: z.string(),
		kind: z.literal("call"),
		resources: z.array(z.string()),
		title: z.string().optional(),
		tool: z.string(),
	})
);
export const CallNodeSchema = z.custom<CallNode>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		CallNodeFields.safeParse(value).success
);

const SequenceNodeFields: z.ZodType<SequenceNode> = z.lazy(() =>
	z.looseObject({
		children: z.array(PlanNodeSchema),
		id: z.string(),
		kind: z.literal("sequence"),
		title: z.string().optional(),
	})
);
export const SequenceNodeSchema = z.custom<SequenceNode>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		SequenceNodeFields.safeParse(value).success
);

const ParallelNodeFields: z.ZodType<ParallelNode> = z.lazy(() =>
	z.looseObject({
		children: z.array(PlanNodeSchema),
		id: z.string(),
		kind: z.literal("parallel"),
		title: z.string().optional(),
	})
);
export const ParallelNodeSchema = z.custom<ParallelNode>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		ParallelNodeFields.safeParse(value).success
);

const IfNodeFields: z.ZodType<IfNode> = z.lazy(() =>
	z.looseObject({
		condition: z.looseObject({
			source: z.string().optional(),
			operator: z.string().optional(),
			value: safeActionsRequestValueSchema.optional(),
			description: z.string().optional(),
		}),
		else: PlanNodeSchema.optional(),
		id: z.string(),
		kind: z.literal("if"),
		[PLAN_THEN_KEY]: PlanNodeSchema,
		title: z.string().optional(),
	})
);
export const IfNodeSchema = z.custom<IfNode>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		IfNodeFields.safeParse(value).success
);

const PolicyLimitsFields: z.ZodType<PolicyLimits> = z.lazy(() =>
	z.looseObject({
		max_bytes: safeActionsNumberSchema,
		max_depth: safeActionsNumberSchema,
		max_nodes: safeActionsNumberSchema,
	})
);
export const PolicyLimitsSchema = z.custom<PolicyLimits>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		PolicyLimitsFields.safeParse(value).success
);

const PolicyFields: z.ZodType<Policy> = z.lazy(() =>
	z.looseObject({
		allow_parallel_reads: z.boolean(),
		allowed_effects: z.array(EffectSchema),
		bound_agent_ids: z.array(z.string()).optional(),
		deny_tool_patterns: z.array(z.string()).optional(),
		description: z.union([z.string(), z.literal(null)]).optional(),
		hash: z.string().optional(),
		id: z.string(),
		limits: PolicyLimitsSchema,
		name: z.string(),
		resource_prefixes: z.array(z.string()),
		review_effects: z.array(EffectSchema),
		review_tools: z.array(z.string()),
		tool_patterns: z.array(z.string()),
		updated_at: z.string().optional(),
		version: safeActionsNumberSchema.optional(),
	})
);
export const PolicySchema = z.custom<Policy>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		PolicyFields.safeParse(value).success
);

const CatalogToolFields: z.ZodType<CatalogTool> = z.lazy(() =>
	z.looseObject({
		arguments_independent: z.boolean().optional(),
		attested_by: z.string().optional(),
		contract_hash: z.string().optional(),
		contract_implementation_hash: z.string().optional(),
		contract_stale: z.boolean().optional(),
		description: z.string().optional(),
		effects: z.array(EffectSchema).optional(),
		implementation_hash: z.string().optional(),
		input_schema: safeActionsRequestValueSchema.optional(),
		name: z.string(),
		resource_bindings: z
			.array(
				z.looseObject({
					pointer: z.string(),
					prefix: z.string(),
				})
			)
			.optional(),
		resources: z.array(z.string()).optional(),
		schema_hash: z.string().optional(),
		trust: z.string().optional(),
	})
);
export const CatalogToolSchema = z.custom<CatalogTool>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		CatalogToolFields.safeParse(value).success
);

const CatalogFields: z.ZodType<Catalog> = z.lazy(() =>
	z.looseObject({
		hash: z.string().optional(),
		tools: z.array(CatalogToolSchema),
	})
);
export const CatalogSchema = z.custom<Catalog>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		CatalogFields.safeParse(value).success
);

export const FindingSeveritySchema: z.ZodType<FindingSeverity> = z.lazy(() =>
	z.union([z.literal("info"), z.literal("review"), z.literal("deny")])
);

const FindingFields: z.ZodType<Finding> = z.lazy(() =>
	z.looseObject({
		code: z.string(),
		counterexample: z
			.union([z.string(), z.record(z.string(), safeActionsRequestValueSchema)])
			.optional(),
		id: z.string().optional(),
		message: z.string(),
		node_id: z.string().optional(),
		severity: FindingSeveritySchema,
		title: z.string().optional(),
	})
);
export const FindingSchema = z.custom<Finding>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		FindingFields.safeParse(value).success
);

const ProofHashesFields: z.ZodType<ProofHashes> = z.lazy(() =>
	z.looseObject({
		catalog_hash: z.string().optional(),
		certificate_hash: z.string().optional(),
		plan_hash: z.string().optional(),
		policy_hash: z.string().optional(),
		verifier_hash: z.string().optional(),
	})
);
export const ProofHashesSchema = z.custom<ProofHashes>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		ProofHashesFields.safeParse(value).success
);

const ReviewSummaryFields: z.ZodType<ReviewSummary> = z.lazy(() =>
	z.looseObject({
		created_at: z.string(),
		id: z.string(),
		node_count: safeActionsNumberSchema.optional(),
		policy_name: z.string().optional(),
		review_reason: z.string().optional(),
		status: z.union([
			z.literal("pending"),
			z.literal("approved"),
			z.literal("denied"),
			z.literal("executing"),
			z.literal("closed"),
			z.literal("expired"),
		]),
		title: z.string(),
	})
);
export const ReviewSummarySchema = z.custom<ReviewSummary>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		ReviewSummaryFields.safeParse(value).success
);

const ReviewDetailFields: z.ZodType<ReviewDetail> = z.lazy(() =>
	ReviewSummarySchema.and(
		z.looseObject({
			catalog: CatalogSchema.optional(),
			certificate: z
				.intersection(
					ProofHashesSchema,
					z.looseObject({
						expires_at: z.string().optional(),
						algorithm: z.string().optional(),
					})
				)
				.optional(),
			findings: z.array(FindingSchema),
			plan: PlanNodeSchema,
			policy: PolicySchema.optional(),
			proof: ProofHashesSchema.optional(),
			review_block_reason: z.string().optional(),
			reviewable: z.boolean().optional(),
		})
	)
);
export const ReviewDetailSchema = z.custom<ReviewDetail>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		ReviewDetailFields.safeParse(value).success
);

export const ReceiptStatusSchema: z.ZodType<ReceiptStatus> = z.lazy(() =>
	z.union([
		z.literal("queued"),
		z.literal("running"),
		z.literal("succeeded"),
		z.literal("failed"),
		z.literal("denied"),
		z.literal("uncertain"),
	])
);

const ReceiptSummaryFields: z.ZodType<ReceiptSummary> = z.lazy(() =>
	z.looseObject({
		finished_at: z.union([z.string(), z.literal(null)]).optional(),
		id: z.string(),
		policy_name: z.string().optional(),
		started_at: z.string(),
		status: ReceiptStatusSchema,
		title: z.string(),
		tool_count: safeActionsNumberSchema.optional(),
	})
);
export const ReceiptSummarySchema = z.custom<ReceiptSummary>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		ReceiptSummaryFields.safeParse(value).success
);

const ReceiptStepFields: z.ZodType<ReceiptStep> = z.lazy(() =>
	z.looseObject({
		argument_hash: z.string().optional(),
		arguments_hash: z.string().optional(),
		error: z.union([z.string(), z.literal(null)]).optional(),
		finished_at: z.union([z.string(), z.literal(null)]).optional(),
		id: z.string(),
		index: safeActionsNumberSchema,
		resources: z.array(z.string()).optional(),
		result_hash: z.union([z.string(), z.literal(null)]).optional(),
		started_at: z.string().optional(),
		status: z.union([ReceiptStatusSchema, z.literal("skipped")]),
		tool: z.string(),
	})
);
export const ReceiptStepSchema = z.custom<ReceiptStep>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		ReceiptStepFields.safeParse(value).success
);

const ReceiptDetailFields: z.ZodType<ReceiptDetail> = z.lazy(() =>
	ReceiptSummarySchema.and(
		z.looseObject({
			certificate: ProofHashesSchema.optional(),
			error: z.union([z.string(), z.literal(null)]).optional(),
			policy_id: z.string().optional(),
			proof: ProofHashesSchema.optional(),
			steps: z.array(ReceiptStepSchema),
			uncertain_after_crash: z.boolean().optional(),
		})
	)
);
export const ReceiptDetailSchema = z.custom<ReceiptDetail>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		ReceiptDetailFields.safeParse(value).success
);

const DecisionResponseFields: z.ZodType<DecisionResponse> = z.lazy(() =>
	z.looseObject({
		message: z.string().optional(),
		review: ReviewDetailSchema.optional(),
		status: z.string().optional(),
	})
);
export const DecisionResponseSchema = z.custom<DecisionResponse>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		DecisionResponseFields.safeParse(value).success
);

const CorePolicyFields: z.ZodType<CorePolicy> = z.lazy(() =>
	z.looseObject({
		allow_parallel_reads: z.boolean().optional(),
		allow_tools: z.array(z.string()).optional(),
		allowed_effects: z.array(z.string()).optional(),
		allowed_resources: z.array(z.string()).optional(),
		deny_tools: z.array(z.string()).optional(),
		limits: z
			.looseObject({
				max_plan_bytes: safeActionsNumberSchema.optional(),
				max_nodes: safeActionsNumberSchema.optional(),
				max_depth: safeActionsNumberSchema.optional(),
			})
			.optional(),
		review_effects: z.array(z.string()).optional(),
		review_tools: z.array(z.string()).optional(),
	})
);
export const CorePolicySchema = z.custom<CorePolicy>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		CorePolicyFields.safeParse(value).success
);

const CorePolicyRecordFields: z.ZodType<CorePolicyRecord> = z.lazy(() =>
	z.looseObject({
		bound_agent_ids: z.array(z.string()).optional(),
		description: z.union([z.string(), z.literal(null)]).optional(),
		created_at: z.string().optional(),
		id: z.string(),
		name: z.string(),
		policy: CorePolicySchema,
		policy_hash: z.string().optional(),
		updated_at: z.string().optional(),
		version: safeActionsNumberSchema.optional(),
	})
);
export const CorePolicyRecordSchema = z.custom<CorePolicyRecord>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		CorePolicyRecordFields.safeParse(value).success
);

const CoreContractFields: z.ZodType<CoreContract> = z.lazy(() =>
	z.looseObject({
		arguments_independent: z.boolean().optional(),
		effects: z.array(z.string()).optional(),
		resource_bindings: z
			.array(
				z.looseObject({
					pointer: z.string().optional(),
					prefix: z.string().optional(),
				})
			)
			.optional(),
		resources: z.array(z.string()).optional(),
		trust: z.string().optional(),
	})
);
export const CoreContractSchema = z.custom<CoreContract>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		CoreContractFields.safeParse(value).success
);

const CoreToolDescriptorFields: z.ZodType<CoreToolDescriptor> = z.lazy(() =>
	z.looseObject({
		attested_by: z.string().optional(),
		contract: z.union([CoreContractSchema, z.literal(null)]).optional(),
		contract_hash: z.string().optional(),
		contract_implementation_hash: z.string().optional(),
		contract_stale: z.boolean().optional(),
		implementation_hash: z.string().optional(),
		input_schema: safeActionsRequestValueSchema.optional(),
		output_schema: safeActionsRequestValueSchema.optional(),
		dispatch_chain: z.array(z.string()).optional(),
		name: z.string(),
	})
);
export const CoreToolDescriptorSchema = z.custom<CoreToolDescriptor>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		CoreToolDescriptorFields.safeParse(value).success
);

const CoreAgentFields: z.ZodType<CoreAgent> = z.lazy(() =>
	z.looseObject({
		lifecycle_status: z.string().optional(),
		id: z.string().optional(),
		name: z.string().optional(),
		title: z.string().optional(),
	})
);
export const CoreAgentSchema = z.custom<CoreAgent>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		CoreAgentFields.safeParse(value).success
);

const CorePlanNodeFields: z.ZodType<CorePlanNode> = z.lazy(() =>
	z.looseObject({
		arguments: safeActionsRequestValueSchema.optional(),
		arguments_redacted: z.boolean().optional(),
		else_node: CorePlanNodeSchema.optional(),
		id: z.string(),
		kind: z.union([
			z.literal("call"),
			z.literal("sequence"),
			z.literal("parallel"),
			z.literal("if"),
		]),
		nodes: z.array(CorePlanNodeSchema).optional(),
		predicate: safeActionsRequestValueSchema.optional(),
		then_node: CorePlanNodeSchema.optional(),
		tool: z.string().optional(),
	})
);
export const CorePlanNodeSchema = z.custom<CorePlanNode>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		CorePlanNodeFields.safeParse(value).success
);

const CoreFindingFields: z.ZodType<CoreFinding> = z.lazy(() =>
	z.looseObject({
		code: z.string().optional(),
		message: z.string().optional(),
		node_id: z.string().optional(),
		path: z.string().optional(),
		severity: z.string().optional(),
	})
);
export const CoreFindingSchema = z.custom<CoreFinding>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		CoreFindingFields.safeParse(value).success
);

const CoreCounterexampleFields: z.ZodType<CoreCounterexample> = z.lazy(() =>
	z.looseObject({
		effect: z.string().optional(),
		node_id: z.string().optional(),
		reason: z.string().optional(),
		resource: z.string().optional(),
		tool: z.string().optional(),
	})
);
export const CoreCounterexampleSchema = z.custom<CoreCounterexample>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		CoreCounterexampleFields.safeParse(value).success
);

const CoreBindingsFields: z.ZodType<CoreBindings> = z.lazy(() =>
	z.looseObject({
		catalog_hash: z.string().optional(),
		agent_revision: z.string().optional(),
		plan_hash: z.string().optional(),
		policy_hash: z.string().optional(),
		verifier_version: z.string().optional(),
	})
);
export const CoreBindingsSchema = z.custom<CoreBindings>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		CoreBindingsFields.safeParse(value).success
);

const CoreCertificateFields: z.ZodType<CoreCertificate> = z.lazy(() =>
	z.looseObject({
		data: z
			.looseObject({
				schema_version: safeActionsNumberSchema.optional(),
				issued_at_unix_ms: safeActionsNumberSchema.optional(),
				bindings: CoreBindingsSchema.optional(),
				expires_at_unix_ms: safeActionsNumberSchema.optional(),
			})
			.optional(),
		integrity_hash: z.string().optional(),
	})
);
export const CoreCertificateSchema = z.custom<CoreCertificate>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		CoreCertificateFields.safeParse(value).success
);

const CoreSubmissionFields: z.ZodType<CoreSubmission> = z.lazy(() =>
	z.looseObject({
		agent_id: z.string().optional(),
		agent_revision: z.string().optional(),
		submission_key: z.string().optional(),
		host_conversation_id: z.union([z.string(), z.literal(null)]).optional(),
		review_note: z.union([z.string(), z.literal(null)]).optional(),
		reviewed_by: z.union([z.string(), z.literal(null)]).optional(),
		reviewed_at: z.union([z.string(), z.literal(null)]).optional(),
		updated_at: z.string().optional(),
		certificate: z.union([CoreCertificateSchema, z.literal(null)]).optional(),
		created_at: z.string().optional(),
		id: z.string(),
		plan: z
			.looseObject({
				schema_version: safeActionsNumberSchema.optional(),
				root: CorePlanNodeSchema.optional(),
			})
			.optional(),
		policy_id: z.string().optional(),
		report: z
			.looseObject({
				decision: z.string().optional(),
				bindings: CoreBindingsSchema.optional(),
				findings: z.array(CoreFindingSchema).optional(),
				counterexamples: z.array(CoreCounterexampleSchema).optional(),
				argument_hashes: z.record(z.string(), z.string()).optional(),
				invocation_resources: z
					.record(z.string(), z.array(z.string()))
					.optional(),
				node_count: safeActionsNumberSchema.optional(),
				max_depth: safeActionsNumberSchema.optional(),
				canonical_plan_bytes: safeActionsNumberSchema.optional(),
			})
			.optional(),
		status: z.string().optional(),
	})
);
export const CoreSubmissionSchema = z.custom<CoreSubmission>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		CoreSubmissionFields.safeParse(value).success
);

const CoreStepReceiptFields: z.ZodType<CoreStepReceipt> = z.lazy(() =>
	z.looseObject({
		arguments_hash: z.string().optional(),
		error: z.union([z.string(), z.literal(null)]).optional(),
		finished_at: z.union([z.string(), z.literal(null)]).optional(),
		ordinal: safeActionsNumberSchema.optional(),
		result_hash: z.union([z.string(), z.literal(null)]).optional(),
		started_at: z.string().optional(),
		status: z.string().optional(),
		step_id: z.string().optional(),
		tool: z.string().optional(),
	})
);
export const CoreStepReceiptSchema = z.custom<CoreStepReceipt>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		CoreStepReceiptFields.safeParse(value).success
);

const CoreReceiptFields: z.ZodType<CoreReceipt> = z.lazy(() =>
	z.looseObject({
		agent_id: z.string().optional(),
		certificate_id: z.string().optional(),
		result_hash: z.union([z.string(), z.literal(null)]).optional(),
		catalog_hash: z.string().optional(),
		error: z.union([z.string(), z.literal(null)]).optional(),
		finished_at: z.union([z.string(), z.literal(null)]).optional(),
		id: z.string(),
		plan_hash: z.string().optional(),
		policy_hash: z.string().optional(),
		started_at: z.string().optional(),
		status: z.string().optional(),
		steps: z.array(CoreStepReceiptSchema).optional(),
		submission_id: z.string().optional(),
		verifier_version: z.string().optional(),
	})
);
export const CoreReceiptSchema = z.custom<CoreReceipt>(
	(value) =>
		safeActionsRequestValueSchema.safeParse(value).success &&
		CoreReceiptFields.safeParse(value).success
);
