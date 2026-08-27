import { describe, expect, it } from "bun:test";
import {
	adaptCatalog,
	adaptPolicy,
	adaptReceipt,
	adaptReview,
	policyInput,
} from "./api.ts";
import { proofFixtureRequest, resetProofFixturesForTests } from "./fixtures.ts";

describe("Core response adapters", () => {
	it("round-trips the policy fields without weakening default deny", () => {
		const policy = adaptPolicy({
			id: "policy-1",
			name: "Repository reads",
			policy: {
				allow_tools: ["github.*"],
				deny_tools: ["github.delete_repository"],
				allowed_effects: ["read"],
				allowed_resources: ["repo/acme/*"],
				review_tools: ["github.create_issue"],
				review_effects: ["write"],
				allow_parallel_reads: true,
				limits: { max_plan_bytes: 4096, max_nodes: 8, max_depth: 3 },
			},
			bound_agent_ids: ["agent-1"],
			version: 4,
		});

		expect(policy.deny_tool_patterns).toEqual(["github.delete_repository"]);
		expect(policy.bound_agent_ids).toEqual(["agent-1"]);
		expect(policyInput(policy)).toMatchObject({
			expected_version: 4,
			policy: {
				allow_tools: ["github.*"],
				deny_tools: ["github.delete_repository"],
				allowed_effects: ["read"],
				limits: { max_plan_bytes: 4096, max_nodes: 8, max_depth: 3 },
			},
		});
	});

	it("maps the finite Core plan DSL and deterministic findings", () => {
		const review = adaptReview(
			{
				id: "submission-1",
				agent_id: "agent-1",
				policy_id: "policy-1",
				status: "pending_review",
				created_at: "2026-08-23T00:00:00Z",
				plan: {
					root: {
						id: "root",
						kind: "sequence",
						nodes: [
							{
								id: "call-1",
								kind: "call",
								tool: "github.create_issue",
								arguments_redacted: true,
								arguments: {
									kind: "object",
									fields: {
										title: { kind: "literal", value: "[redacted by Core]" },
										token: { kind: "literal", value: "[redacted by Core]" },
									},
								},
							},
						],
					},
				},
				report: {
					decision: "needs_review",
					node_count: 2,
					bindings: {
						plan_hash: "plan-hash",
						policy_hash: "policy-hash",
						catalog_hash: "catalog-hash",
						verifier_version: "safe-actions-v1",
					},
					findings: [
						{
							severity: "review",
							code: "review_tool",
							message: "This tool requires review",
							node_id: "call-1",
						},
					],
					counterexamples: [],
					argument_hashes: { "call-1": "args-hash" },
					invocation_resources: { "call-1": ["repo:acme/project"] },
				},
			},
			{
				catalog: {
					catalog_hash: "catalog-hash",
					tools: [
						{
							name: "github.create_issue",
							contract: {
								trust: "operator_attested",
								effects: ["write"],
								resources: ["repo:acme/project"],
							},
						},
					],
				},
			}
		);

		expect(review.status).toBe("pending");
		expect(review.plan).toMatchObject({
			kind: "sequence",
			children: [
				{
					kind: "call",
					tool: "github.create_issue",
					effects: ["write"],
					resources: ["repo:acme/project"],
					arguments_hash: "args-hash",
				},
			],
		});
		expect(review.reviewable).toBe(true);
		expect(JSON.stringify(review.plan)).toContain("[redacted by Core]");
		expect(JSON.stringify(review.plan)).not.toContain("secret");
		expect(review.findings[0]).toMatchObject({
			severity: "review",
			node_id: "call-1",
		});
		expect(review.proof?.plan_hash).toBe("plan-hash");
	});

	it("shows crash uncertainty and hashes without inventing success", () => {
		const receipt = adaptReceipt({
			id: "receipt-1",
			submission_id: "submission-1",
			status: "unknown_after_crash",
			started_at: "2026-08-23T00:00:00Z",
			plan_hash: "plan-hash",
			steps: [
				{
					step_id: "call-1",
					ordinal: 1,
					tool: "github.create_issue",
					status: "unknown_after_crash",
					arguments_hash: "args-hash",
				},
			],
		});

		expect(receipt.status).toBe("uncertain");
		expect(receipt.uncertain_after_crash).toBe(true);
		expect(receipt.steps[0]).toMatchObject({
			status: "uncertain",
			arguments_hash: "args-hash",
		});
	});

	it("rejects malformed list and catalog envelopes", () => {
		expect(() => adaptCatalog({ catalog_hash: "hash" })).toThrow(
			"invalid tool catalog"
		);
	});

	it("blocks approval presentation when proof or tool contracts are incomplete", () => {
		const review = adaptReview(
			{
				id: "review-unsafe",
				status: "pending_review",
				agent_id: "agent-1",
				created_at: "2026-08-23T00:00:00Z",
				plan: {
					root: {
						id: "call-1",
						kind: "call",
						tool: "mail.send",
						arguments: { kind: "literal", value: "secret" },
					},
				},
				report: {
					decision: "needs_review",
					bindings: {
						plan_hash: "plan",
						policy_hash: "policy",
						catalog_hash: "catalog",
						verifier_version: "v1",
					},
				},
			},
			{ tools: [{ name: "mail.send", contract: null }] }
		);
		expect(review.reviewable).toBe(false);
		expect(review.review_block_reason).toContain("mail.send");
		expect(JSON.stringify(review.plan)).not.toContain("secret");
		expect(JSON.stringify(review.plan)).toContain(
			"Core-redacted argument structure unavailable"
		);
	});

	it("blocks approval when the live catalog differs from the bound catalog", () => {
		const review = adaptReview(
			{
				id: "review-stale-catalog",
				status: "pending_review",
				agent_id: "agent-1",
				created_at: "2026-08-23T00:00:00Z",
				plan: {
					root: {
						id: "call-1",
						kind: "call",
						tool: "mail.send",
						arguments_redacted: true,
						arguments: {
							kind: "object",
							fields: {
								message: { kind: "literal", value: "[redacted by Core]" },
							},
						},
					},
				},
				report: {
					decision: "needs_review",
					bindings: {
						plan_hash: "plan",
						policy_hash: "policy",
						catalog_hash: "catalog-at-verification",
						verifier_version: "v1",
					},
					argument_hashes: { "call-1": "args" },
					invocation_resources: { "call-1": ["mailbox:operator"] },
				},
			},
			{
				catalog_hash: "catalog-now",
				tools: [
					{
						name: "mail.send",
						contract: {
							trust: "operator_attested",
							effects: ["communicate"],
							resources: ["mailbox:operator"],
						},
					},
				],
			}
		);

		expect(review.reviewable).toBe(false);
		expect(review.review_block_reason).toContain("does not match");
	});

	it("uses the persisted proof catalog hash for presentation reviews", () => {
		const review = adaptReview(
			{
				id: "review-presentation",
				title: "Presentation fixture",
				status: "pending",
				created_at: "2026-08-23T00:00:00Z",
				plan: { id: "root", kind: "sequence", children: [] },
				findings: [],
				proof: { catalog_hash: "catalog-at-verification" },
				certificate: { catalog_hash: "catalog-now" },
			},
			{ catalog_hash: "catalog-now", tools: [] }
		);

		expect(review.reviewable).toBe(false);
		expect(review.review_block_reason).toContain("does not match");
	});

	it("restores mutated proof fixtures to their deterministic seed", async () => {
		resetProofFixturesForTests();
		const before = (await proofFixtureRequest({
			path: "/reviews/review-release-0142",
		})) as { review: { status: string } };
		expect(before.review.status).toBe("pending");

		await proofFixtureRequest({
			method: "POST",
			path: "/reviews/review-release-0142/approve",
		});
		const decided = (await proofFixtureRequest({
			path: "/reviews/review-release-0142",
		})) as { review: { status: string } };
		expect(decided.review.status).toBe("approved");

		resetProofFixturesForTests();
		const restored = (await proofFixtureRequest({
			path: "/reviews/review-release-0142",
		})) as { review: { status: string } };
		expect(restored.review.status).toBe("pending");
	});
});
