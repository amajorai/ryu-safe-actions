import { afterEach, describe, expect, test } from "bun:test";
import { localizeAdapterCopy } from "./adapter-copy.ts";
import { catalogHost, flushHost } from "./i18n-test-doubles.ts";
import { resetCompanionI18nForTests, startCompanionI18n } from "./ryu-i18n.ts";

afterEach(() => {
	resetCompanionI18nForTests();
});

/** Ask once, let the host answer, then read the cached translation. */
async function localizedUnder(
	catalog: Record<string, string>,
	text: string,
	locale = "de"
): Promise<string> {
	startCompanionI18n(catalogHost(locale, catalog));
	await flushHost();
	localizeAdapterCopy(text);
	await flushHost();
	return localizeAdapterCopy(text);
}

describe("localizeAdapterCopy", () => {
	test("keeps English adapter copy as written outside a host", () => {
		const copy = [
			"Plan from agent-7",
			"Verifier decision: deny.",
			"One or more proof bindings are missing.",
			"Conditional branch",
			"Compare typed values (equal)",
			"all of predicate",
			"Execution sub-42",
		];
		for (const text of copy) {
			expect(localizeAdapterCopy(text)).toBe(text);
		}
		expect(localizeAdapterCopy("Plan from verified agent")).toBe(
			"Plan from a verified agent"
		);
		expect(localizeAdapterCopy(undefined)).toBeUndefined();
	});

	test("translates the review heading with the agent id kept verbatim", async () => {
		expect(
			await localizedUnder(
				{ "Plan from {agent}": "Plan von {agent}" },
				"Plan from agent-7"
			)
		).toBe("Plan von agent-7");
	});

	test("translates the verifier explanation and decision", async () => {
		expect(
			await localizedUnder(
				{
					"The deterministic verifier proved the plan is within policy but found rules that require human judgment.":
						"Prüfung: Der Verifizierer hat Regeln gefunden, die menschliches Urteil erfordern.",
				},
				"The deterministic verifier proved the plan is within policy but found rules that require human judgment."
			)
		).toStartWith("Prüfung");
		resetCompanionI18nForTests();
		expect(
			await localizedUnder(
				{ "Verifier decision: {decision}.": "Prüfergebnis: {decision}." },
				"Verifier decision: deny."
			)
		).toBe("Prüfergebnis: deny.");
	});

	test("translates why approval is unavailable", async () => {
		const tool =
			"Tool {tool} is missing a Core-redacted argument structure, a Core argument hash, or proved invocation resources.";
		expect(
			await localizedUnder(
				{ [tool]: "Dem Tool {tool} fehlen Nachweise." },
				"Tool fs.write is missing a Core-redacted argument structure, a Core argument hash, or proved invocation resources."
			)
		).toBe("Dem Tool fs.write fehlen Nachweise.");
		resetCompanionI18nForTests();
		expect(
			await localizedUnder(
				{
					"Core did not return the verifier report.":
						"Core hat keinen Prüfbericht geliefert.",
				},
				"Core did not return the verifier report."
			)
		).toBe("Core hat keinen Prüfbericht geliefert.");
	});

	test("translates plan-node labels and keeps codes verbatim", async () => {
		expect(
			await localizedUnder(
				{ "Conditional branch": "Bedingte Verzweigung" },
				"Conditional branch"
			)
		).toBe("Bedingte Verzweigung");
		resetCompanionI18nForTests();
		expect(
			await localizedUnder(
				{ "{kind} predicate": "Prädikat {kind}" },
				"all of predicate"
			)
		).toBe("Prädikat all of");
		resetCompanionI18nForTests();
		expect(
			await localizedUnder(
				{ "Execution {id}": "Ausführung {id}" },
				"Execution sub-42"
			)
		).toBe("Ausführung sub-42");
	});

	test("translates the same copy under Japanese and Arabic hosts", async () => {
		expect(
			await localizedUnder(
				{ "Plan from {agent}": "{agent} からのプラン" },
				"Plan from agent-7",
				"ja"
			)
		).toBe("agent-7 からのプラン");
		resetCompanionI18nForTests();
		expect(
			await localizedUnder(
				{
					"One or more proof bindings are missing.":
						"رابط إثبات واحد أو أكثر مفقود.",
				},
				"One or more proof bindings are missing.",
				"ar"
			)
		).toBe("رابط إثبات واحد أو أكثر مفقود.");
	});

	test("leaves caller-written titles alone", async () => {
		const host = catalogHost("de", {});
		startCompanionI18n(host);
		await flushHost();
		for (const text of [
			"Plan from the release checklist",
			"Execution of the nightly backup",
			"Publish v0.1.14 and notify release channel",
		]) {
			expect(localizeAdapterCopy(text)).toBe(text);
		}
		await flushHost();
		expect(host.requests).toEqual([]);
	});
});
