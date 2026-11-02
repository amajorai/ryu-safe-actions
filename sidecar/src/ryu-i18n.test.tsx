import { afterEach, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { Root } from "react-dom/client";
import { setRequesterForTests } from "./api.ts";
import { proofFixtureRequest, resetProofFixturesForTests } from "./fixtures.ts";
import type {
	CompanionI18nBridge,
	CompanionI18nSnapshot,
	CompanionMessageValues,
} from "./ryu.d.ts";

if (!GlobalRegistrator.isRegistered) {
	GlobalRegistrator.register();
}
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { App } = await import("./App.tsx");
const { RyuAppShell } = await import("./ryu-app-ui.tsx");
const { formatEnglish, resetCompanionI18nForTests, tl } = await import(
	"./ryu-i18n.ts"
);

/** Host catalogs keyed by English source literal, as the host resolves them. */
const CATALOGS: Record<string, Record<string, string>> = {
	de: {
		Reviews: "Prüfungen",
		"Skip to main content": "Zum Hauptinhalt springen",
		"{surface} · Safe Actions": "{surface} · Sichere Aktionen",
	},
	ar: {
		Reviews: "المراجعات",
		"Skip to main content": "انتقل إلى المحتوى الرئيسي",
		"{surface} · Safe Actions": "{surface} · الإجراءات الآمنة",
	},
	ja: {
		Reviews: "レビュー",
		"Skip to main content": "メインコンテンツへスキップ",
		"{surface} · Safe Actions": "{surface} · 安全なアクション",
	},
};

function hostBridge(
	locale: string,
	direction: CompanionI18nSnapshot["direction"]
): CompanionI18nBridge & {
	publish(next: CompanionI18nSnapshot): void;
	requests: string[];
} {
	let snapshot: CompanionI18nSnapshot = {
		direction,
		locale,
		packId: null,
		packName: null,
		packVersion: null,
	};
	const requests: string[] = [];
	const listeners = new Set<(next: CompanionI18nSnapshot) => void>();
	return {
		requests,
		publish: (next) => {
			snapshot = next;
			for (const listener of listeners) {
				listener(next);
			}
		},
		get: async () => snapshot,
		subscribe: ({ onChange }) => {
			listeners.add(onChange);
			onChange(snapshot);
			return { dispose: () => listeners.delete(onChange) };
		},
		translate: async ({ defaultMessage, values }) => {
			requests.push(defaultMessage);
			const message =
				CATALOGS[snapshot.locale]?.[defaultMessage] ?? defaultMessage;
			return formatEnglish(message, values as CompanionMessageValues);
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
	Reflect.deleteProperty(window, "ryu");
	setRequesterForTests();
	resetProofFixturesForTests();
	resetCompanionI18nForTests();
	document.documentElement.removeAttribute("lang");
	document.documentElement.removeAttribute("dir");
});

async function settle() {
	await act(async () => {
		for (let tick = 0; tick < 8; tick += 1) {
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	});
}

async function renderUnder(
	locale: string,
	direction: CompanionI18nSnapshot["direction"]
) {
	const bridge = hostBridge(locale, direction);
	Reflect.set(window, "ryu", { context: { surface: "reviews" }, i18n: bridge });
	setRequesterForTests(proofFixtureRequest);
	mount = document.createElement("div");
	document.body.append(mount);
	root = createRoot(mount);
	await act(async () =>
		root?.render(
			<RyuAppShell>
				<App />
			</RyuAppShell>
		)
	);
	await settle();
	const shell = mount.firstElementChild as HTMLElement;
	return { bridge, shell };
}

describe("Safe Actions Companion i18n", () => {
	test("follows a Japanese host: lang, title, and rendered chrome", async () => {
		const { shell } = await renderUnder("ja", "ltr");

		expect(document.documentElement.lang).toBe("ja");
		expect(document.documentElement.dir).toBe("ltr");
		expect(shell.getAttribute("lang")).toBe("ja");
		expect(shell.getAttribute("dir")).toBe("ltr");
		expect(document.title).toBe("レビュー · 安全なアクション");
		expect(shell.textContent).toContain("メインコンテンツへスキップ");
		expect(shell.textContent).not.toContain("Skip to main content");
	});

	test("follows an Arabic host right to left", async () => {
		const { shell } = await renderUnder("ar", "rtl");

		expect(document.documentElement.lang).toBe("ar");
		expect(document.documentElement.dir).toBe("rtl");
		expect(shell.getAttribute("dir")).toBe("rtl");
		expect(document.title).toBe("المراجعات · الإجراءات الآمنة");
		expect(shell.textContent).toContain("انتقل إلى المحتوى الرئيسي");
	});

	test("switches languages live and restores English without asking the host", async () => {
		const { bridge, shell } = await renderUnder("de", "ltr");
		expect(document.title).toBe("Prüfungen · Sichere Aktionen");
		expect(shell.textContent).toContain("Zum Hauptinhalt springen");

		await act(async () =>
			bridge.publish({
				direction: "rtl",
				locale: "ar",
				packId: null,
				packName: null,
				packVersion: null,
			})
		);
		await settle();
		expect(shell.getAttribute("dir")).toBe("rtl");
		expect(document.title).toBe("المراجعات · الإجراءات الآمنة");
		expect(shell.textContent).toContain("انتقل إلى المحتوى الرئيسي");
		expect(shell.textContent).not.toContain("Zum Hauptinhalt springen");

		await act(async () =>
			bridge.publish({
				direction: "ltr",
				locale: "en",
				packId: null,
				packName: null,
				packVersion: null,
			})
		);
		await settle();
		const asked = bridge.requests.length;
		expect(shell.getAttribute("lang")).toBe("en");
		expect(shell.getAttribute("dir")).toBe("ltr");
		expect(document.title).toBe("Reviews · Safe Actions");
		expect(shell.textContent).toContain("Skip to main content");
		expect(shell.textContent).not.toContain("انتقل إلى المحتوى الرئيسي");
		await settle();
		expect(bridge.requests.length).toBe(asked);
	});

	test("never rewrites code or opted-out data", async () => {
		const { bridge, shell } = await renderUnder("ja", "ltr");
		const code = document.createElement("code");
		code.textContent = "Reviews";
		const optedOut = document.createElement("span");
		optedOut.dataset.ryuI18n = "off";
		optedOut.textContent = "Reviews";
		const userData = document.createElement("strong");
		userData.setAttribute("translate", "no");
		userData.textContent = "Reviews";
		shell.append(code, optedOut, userData);
		await settle();

		expect(code.textContent).toBe("Reviews");
		expect(optedOut.textContent).toBe("Reviews");
		expect(userData.textContent).toBe("Reviews");
		expect(bridge.requests.length).toBeGreaterThan(0);
	});

	test("stays English without a host bridge", async () => {
		setRequesterForTests(proofFixtureRequest);
		expect(tl("{surface} · Safe Actions", { surface: "Reviews" })).toBe(
			"Reviews · Safe Actions"
		);
		mount = document.createElement("div");
		document.body.append(mount);
		root = createRoot(mount);
		await act(async () =>
			root?.render(
				<RyuAppShell>
					<App />
				</RyuAppShell>
			)
		);
		await settle();
		const shell = mount.firstElementChild as HTMLElement;
		expect(shell.getAttribute("lang")).toBe("en");
		expect(shell.getAttribute("dir")).toBe("ltr");
		expect(shell.textContent).toContain("Skip to main content");
	});
});
