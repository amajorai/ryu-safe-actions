import { afterEach, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { Root } from "react-dom/client";
import { setRequesterForTests } from "./api.ts";
import { proofFixtureRequest, resetProofFixturesForTests } from "./fixtures.ts";
import { catalogHost } from "./i18n-test-doubles.ts";
import type { SafeActionsRequest } from "./ryu.d.ts";
import type { SafeActionsRequestValue } from "./wire.ts";

if (!GlobalRegistrator.isRegistered) {
	GlobalRegistrator.register();
}
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { App } = await import("./App.tsx");
const { RyuAppShell } = await import("./ryu-app-ui.tsx");
const { resetCompanionI18nForTests } = await import("./ryu-i18n.ts");

const REVIEW_REASON =
	"The deterministic verifier proved the plan is within policy but found rules that require human judgment.";
const STATUS_MESSAGE =
	"{status, select, pending {pending} approved {approved} denied {denied} executing {executing} running {running} queued {queued} closed {closed} expired {expired} succeeded {succeeded} failed {failed} uncertain {uncertain} skipped {skipped} other {{status}}}";

const GERMAN: Record<string, string> = {
	"Plan from {agent}": "Plan von {agent}",
	[REVIEW_REASON]:
		"Prüfung erforderlich: Der Plan liegt innerhalb der Richtlinie, aber Regeln verlangen ein menschliches Urteil.",
	[STATUS_MESSAGE]:
		"{status, select, pending {ausstehend} denied {abgelehnt} other {{status}}}",
};

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
});

/** The fixture review as the Core adapter words it. */
async function adapterWorded(request: SafeActionsRequest) {
	const value = await proofFixtureRequest(request);
	if (request.path.startsWith("/reviews/")) {
		const review = structuredClone(
			(value as { review: Record<string, SafeActionsRequestValue> }).review
		);
		review.title = "Plan from agent-7";
		review.review_reason = REVIEW_REASON;
		return { review };
	}
	if (request.path === "/reviews") {
		const { reviews } = value as {
			reviews: Record<string, SafeActionsRequestValue>[];
		};
		return {
			reviews: reviews.map((review) => ({
				...review,
				title: "Plan from agent-7",
			})),
		};
	}
	return value;
}

async function settle() {
	await act(async () => {
		for (let tick = 0; tick < 8; tick += 1) {
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	});
}

describe("review adapter copy under a German host", () => {
	test("the heading, the verifier reason and the status word are German", async () => {
		Reflect.set(window, "ryu", {
			context: { surface: "reviews" },
			i18n: catalogHost("de", GERMAN),
		});
		setRequesterForTests(adapterWorded);
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
		await settle();

		const workspace = mount.querySelector("main");
		const heading = workspace?.querySelector("h1");
		expect(heading?.textContent).toBe("Plan von agent-7");
		expect(workspace?.textContent).toContain("Prüfung erforderlich");
		expect(workspace?.textContent).not.toContain(REVIEW_REASON);
		expect(workspace?.textContent).toContain("ausstehend");
	});
});
