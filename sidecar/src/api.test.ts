import { afterEach, describe, expect, it } from "bun:test";
import { z } from "zod";
import {
	adaptCatalog,
	adaptPolicy,
	adaptReceipt,
	adaptReview,
	decideReview,
	policyInput,
	requestApi,
	setRequesterForTests,
} from "./api.ts";
import { ReviewDetailSchema } from "./contracts.ts";
import { proofFixtureRequest, resetProofFixturesForTests } from "./fixtures.ts";
import type { SafeActionsRequest } from "./ryu.d.ts";

afterEach(() => {
	setRequesterForTests();
});

describe("Core response adapters", () => {
	it("refuses direct and encoded path escapes before calling Core", async () => {
		let calls = 0;
		setRequesterForTests(async () => {
			calls += 1;
			return {};
		});
		for (const path of [
			"https://attacker.test/reviews",
			"//attacker.test/reviews",
			"/reviews/../secrets",
			"/reviews/%2e%2e/secrets",
			"/reviews/%2E%2E%5Csecrets",
		]) {
			await expect(requestApi(path)).rejects.toThrow("Refusing");
		}
		await expect(requestApi("/reviews/%E0%A4%A")).rejects.toThrow("malformed");
		expect(calls).toBe(0);
	});

	it("forwards one exact request and leaves refusal retry under caller control", async () => {
		const requests: SafeActionsRequest[] = [];
		setRequesterForTests(async (request) => {
			requests.push(request);
			if (requests.length === 1) {
				throw new Error("permission denied");
			}
			return { review: { id: "review-1" } };
		});

		await expect(
			requestApi("/reviews/review-1/approve", "POST", { note: "approved" })
		).rejects.toThrow("permission denied");
		expect(requests).toHaveLength(1);
		expect(
			await requestApi("/reviews/review-1/approve", "POST", {
				note: "approved",
			})
		).toEqual({ review: { id: "review-1" } });
		expect(requests).toEqual([
			{
				method: "POST",
				path: "/reviews/review-1/approve",
				body: { note: "approved" },
			},
			{
				method: "POST",
				path: "/reviews/review-1/approve",
				body: { note: "approved" },
			},
		]);
	});

	it("binds a decision to the plan hash shown by the review surface", async () => {
		const requests: SafeActionsRequest[] = [];
		setRequesterForTests(async (request) => {
			requests.push(request);
			return { status: "denied_by_reviewer" };
		});

		await decideReview("review-b", "deny", "plan-hash-b", " stale ");
		expect(requests).toEqual([
			{
				method: "POST",
				path: "/reviews/review-b/deny",
				body: {
					expected_plan_hash: "plan-hash-b",
					note: "stale",
				},
			},
		]);
	});
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
		const before = z.object({ review: ReviewDetailSchema }).parse(
			await proofFixtureRequest({
				path: "/reviews/review-release-0142",
			})
		);
		expect(before.review.status).toBe("pending");

		await proofFixtureRequest({
			method: "POST",
			path: "/reviews/review-release-0142/approve",
		});
		const decided = z.object({ review: ReviewDetailSchema }).parse(
			await proofFixtureRequest({
				path: "/reviews/review-release-0142",
			})
		);
		expect(decided.review.status).toBe("approved");

		resetProofFixturesForTests();
		const restored = z.object({ review: ReviewDetailSchema }).parse(
			await proofFixtureRequest({
				path: "/reviews/review-release-0142",
			})
		);
		expect(restored.review.status).toBe("pending");
	});
});

describe("native serde option compatibility", () => {
	it("retains null descriptions and receipt option fields", () => {
		const policy = adaptPolicy({
			id: "policy-null",
			name: "Null description",
			description: null,
			created_at: "2026-01-01",
			policy: {},
		});
		expect(policy.description).toBeNull();
		const receipt = adaptReceipt({
			id: "receipt-null",
			submission_id: "submission",
			certificate_id: "certificate",
			agent_id: "agent",
			status: "running",
			finished_at: null,
			error: null,
			result_hash: null,
			steps: [
				{
					step_id: "step",
					ordinal: 1,
					tool: "read",
					status: "running",
					result_hash: null,
					error: null,
					finished_at: null,
				},
			],
		});
		expect(receipt.finished_at).toBeNull();
		expect(receipt.error).toBeNull();
		expect(receipt.steps[0]?.result_hash).toBeNull();
		expect(receipt.steps[0]?.error).toBeNull();
		expect(receipt.steps[0]?.finished_at).toBeNull();
	});
});
