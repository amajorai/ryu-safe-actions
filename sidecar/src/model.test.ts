import { describe, expect, it } from "bun:test";
import { validatePolicy } from "./model.ts";
import type { Policy } from "./types.ts";

function policy(): Policy {
	return {
		id: "policy-1",
		name: "Verified operations",
		tool_patterns: ["github.*"],
		allowed_effects: ["read", "execute"],
		review_effects: ["execute"],
		review_tools: [],
		resource_prefixes: ["repo:amajorai/ryu"],
		limits: { max_nodes: 128, max_depth: 16, max_bytes: 65_536 },
		allow_parallel_reads: false,
		bound_agent_ids: ["agent-1"],
	};
}

describe("policy validation parity", () => {
	it("accepts the complete finite effect set and Core hard limits", () => {
		expect(validatePolicy(policy()).valid).toBe(true);
	});

	it("rejects fractional and above-Core structural limits", () => {
		const draft = policy();
		draft.limits = { max_nodes: 4097, max_depth: 1.5, max_bytes: 1_048_577 };
		const validation = validatePolicy(draft);
		expect(validation.valid).toBe(false);
		expect(validation.errors).toHaveLength(3);
	});

	it("rejects lexical and encoded resource traversal", () => {
		const draft = policy();
		draft.resource_prefixes = ["repo:amajorai/ryu/%2e%2e/private"];
		expect(validatePolicy(draft).valid).toBe(false);
	});
});
