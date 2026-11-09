import { afterEach, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { Root } from "react-dom/client";
import { catalogHost, flushHost } from "./i18n-test-doubles.ts";
import type { PolicySummaryState } from "./model.ts";
import type { CompanionI18nBridge } from "./ryu.d.ts";

if (!GlobalRegistrator.isRegistered) {
	GlobalRegistrator.register();
}
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { PolicySummary } = await import("./PolicySummary.tsx");
const { resetCompanionI18nForTests, startCompanionI18n } = await import(
	"./ryu-i18n.ts"
);

const ERRORS_MESSAGE =
	"{count, plural, one {# blocking error} other {# blocking errors}}";
const DENY_ALL_MESSAGE = "Consistent · denies all calls";
const REVIEW_MESSAGE =
	"{count, plural, =0 {Consistent · default deny · no review rules} one {Consistent · default deny · # review rule} other {Consistent · default deny · # review rules}}";

const GERMAN: Record<string, string> = {
	[ERRORS_MESSAGE]:
		"{count, plural, one {# blockierender Fehler} other {# blockierende Fehler}}",
	[DENY_ALL_MESSAGE]: "Konsistent · lehnt alle Aufrufe ab",
	[REVIEW_MESSAGE]:
		"{count, plural, =0 {Konsistent · Standardablehnung · keine Prüfregeln} one {Konsistent · Standardablehnung · # Prüfregel} other {Konsistent · Standardablehnung · # Prüfregeln}}",
};

const ARABIC: Record<string, string> = {
	[ERRORS_MESSAGE]:
		"{count, plural, zero {لا أخطاء مانعة} one {خطأ مانع واحد} two {خطآن مانعان} few {# أخطاء مانعة} many {# خطأً مانعًا} other {# خطأ مانع}}",
	[DENY_ALL_MESSAGE]: "متسق · يرفض جميع الاستدعاءات",
	[REVIEW_MESSAGE]:
		"{count, plural, =0 {متسق · رفض افتراضي · لا قواعد مراجعة} one {متسق · رفض افتراضي · قاعدة مراجعة واحدة} two {متسق · رفض افتراضي · قاعدتا مراجعة} few {متسق · رفض افتراضي · # قواعد مراجعة} many {متسق · رفض افتراضي · # قاعدة مراجعة} other {متسق · رفض افتراضي · # قاعدة مراجعة}}",
};

const PLURAL_BRANCH = /(=\d+|zero|one|two|few|many|other) \{([^{}]*)\}/gu;

/**
 * An Arabic host double that formats plurals the way the real host does:
 * an exact `=N` branch first, then the locale's own CLDR category.
 */
function arabicHost(): CompanionI18nBridge {
	const snapshot = {
		direction: "rtl" as const,
		locale: "ar",
		packId: null,
		packName: null,
		packVersion: null,
	};
	const rules = new Intl.PluralRules("ar");
	return {
		get: async () => snapshot,
		subscribe: ({ onChange }) => {
			onChange(snapshot);
			return { dispose: () => undefined };
		},
		translate: async ({ defaultMessage, values }) => {
			const message = ARABIC[defaultMessage] ?? defaultMessage;
			const count = Number(values?.count);
			if (!message.startsWith("{count, plural,")) {
				return message;
			}
			const branches = new Map(
				[...message.matchAll(PLURAL_BRANCH)].map((match) => [
					match[1],
					match[2],
				])
			);
			const body =
				branches.get(`=${count}`) ??
				branches.get(rules.select(count)) ??
				branches.get("other") ??
				"";
			return body.replaceAll("#", String(count));
		},
	};
}

let root: Root | undefined;
let mount: HTMLElement | undefined;

afterEach(async () => {
	if (root) {
		await act(async () => root?.unmount());
	}
	mount?.remove();
	root = undefined;
	mount = undefined;
	resetCompanionI18nForTests();
});

async function renderSummaries(
	summaries: PolicySummaryState[]
): Promise<string[]> {
	mount = document.createElement("div");
	document.body.append(mount);
	root = createRoot(mount);
	await act(async () =>
		root?.render(
			<ul>
				{summaries.map((summary) => (
					<li key={JSON.stringify(summary)}>
						<PolicySummary summary={summary} />
					</li>
				))}
			</ul>
		)
	);
	await act(async () => {
		await flushHost();
	});
	return [...mount.querySelectorAll("li")].map((item) => item.textContent);
}

describe("PolicySummary", () => {
	test("English uses the singular form for one error and one review rule", async () => {
		expect(
			await renderSummaries([
				{ kind: "invalid", errorCount: 1 },
				{ kind: "invalid", errorCount: 2 },
				{ kind: "deny-all" },
				{ kind: "default-deny", reviewRuleCount: 0 },
				{ kind: "default-deny", reviewRuleCount: 1 },
				{ kind: "default-deny", reviewRuleCount: 2 },
			])
		).toEqual([
			"1 blocking error",
			"2 blocking errors",
			"Consistent · denies all calls",
			"Consistent · default deny · no review rules",
			"Consistent · default deny · 1 review rule",
			"Consistent · default deny · 2 review rules",
		]);
	});

	test("a German pack localizes all three kinds, with the one form for 1", async () => {
		const host = catalogHost("de", GERMAN);
		startCompanionI18n(host);
		await flushHost();
		expect(
			await renderSummaries([
				{ kind: "invalid", errorCount: 1 },
				{ kind: "invalid", errorCount: 3 },
				{ kind: "deny-all" },
				{ kind: "default-deny", reviewRuleCount: 0 },
				{ kind: "default-deny", reviewRuleCount: 1 },
				{ kind: "default-deny", reviewRuleCount: 4 },
			])
		).toEqual([
			"1 blockierender Fehler",
			"3 blockierende Fehler",
			"Konsistent · lehnt alle Aufrufe ab",
			"Konsistent · Standardablehnung · keine Prüfregeln",
			"Konsistent · Standardablehnung · 1 Prüfregel",
			"Konsistent · Standardablehnung · 4 Prüfregeln",
		]);
		expect(new Set(host.requests)).toEqual(
			new Set([ERRORS_MESSAGE, DENY_ALL_MESSAGE, REVIEW_MESSAGE])
		);
	});

	test("Arabic picks its own plural categories from the count", async () => {
		startCompanionI18n(arabicHost());
		await flushHost();
		expect(
			await renderSummaries([
				{ kind: "invalid", errorCount: 1 },
				{ kind: "invalid", errorCount: 2 },
				{ kind: "invalid", errorCount: 3 },
				{ kind: "invalid", errorCount: 11 },
				{ kind: "deny-all" },
				{ kind: "default-deny", reviewRuleCount: 0 },
				{ kind: "default-deny", reviewRuleCount: 2 },
				{ kind: "default-deny", reviewRuleCount: 5 },
			])
		).toEqual([
			"خطأ مانع واحد",
			"خطآن مانعان",
			"3 أخطاء مانعة",
			"11 خطأً مانعًا",
			"متسق · يرفض جميع الاستدعاءات",
			"متسق · رفض افتراضي · لا قواعد مراجعة",
			"متسق · رفض افتراضي · قاعدتا مراجعة",
			"متسق · رفض افتراضي · 5 قواعد مراجعة",
		]);
	});
});
