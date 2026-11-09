import { describe, expect, test } from "bun:test";
import { formatMessage } from "./ryu-message-format.ts";

describe("formatMessage", () => {
	test("fills simple arguments and keeps unknown ones", () => {
		expect(formatMessage("Created {time}", { time: "today" })).toBe(
			"Created today"
		);
		expect(formatMessage("Node · {node}")).toBe("Node · {node}");
	});

	test("selects English plural branches with #", () => {
		const source = "{count, plural, one {# node} other {# nodes}}";
		expect(formatMessage(source, { count: 1 })).toBe("1 node");
		expect(formatMessage(source, { count: 0 })).toBe("0 nodes");
		expect(formatMessage(source, { count: 1200 })).toBe("1200 nodes");
		expect(
			formatMessage(
				"{policy} · {count, plural, one {# tool} other {# tools}}",
				{ count: 3, policy: "Release" }
			)
		).toBe("Release · 3 tools");
	});

	test("selects branches and falls back to other with nested arguments", () => {
		const source =
			"{severity, select, deny {deny finding: {message}} other {{severity} finding: {message}}}";
		expect(formatMessage(source, { message: "x", severity: "deny" })).toBe(
			"deny finding: x"
		);
		expect(formatMessage(source, { message: "y", severity: "odd" })).toBe(
			"odd finding: y"
		);
	});

	test("keeps the plural # inside a nested select branch", () => {
		const source =
			"{count, plural, other {{kind, select, a {# a-items} other {# items}}}}";
		expect(formatMessage(source, { count: 4, kind: "a" })).toBe("4 a-items");
	});
});
