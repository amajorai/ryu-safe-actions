import { afterEach, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { Root } from "react-dom/client";
import { setRequesterForTests } from "./api.ts";
import { proofFixtureRequest, resetProofFixturesForTests } from "./fixtures.ts";
import type { SafeActionsRequest } from "./ryu.d.ts";
import type { SafeActionsRequestValue } from "./wire.ts";

if (!GlobalRegistrator.isRegistered) {
	GlobalRegistrator.register();
}
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { Reviews } = await import("./Reviews.tsx");

const FIXTURE_ID = "review-release-0142";
const PLAN_HASH_A = `sha256:${"a".repeat(64)}`;
const PLAN_HASH_B = `sha256:${"b".repeat(64)}`;

let root: Root | undefined;
let host: HTMLElement | undefined;

afterEach(async () => {
	if (root) {
		await act(async () => root?.unmount());
	}
	host?.remove();
	root = undefined;
	host = undefined;
	setRequesterForTests();
	resetProofFixturesForTests();
});

type Detail = Record<string, SafeActionsRequestValue>;

/** The fixture review re-labelled as a distinct persisted plan. */
async function reviewAs(id: string, title: string, planHash: string) {
	const value = await proofFixtureRequest({
		method: "GET",
		path: `/reviews/${FIXTURE_ID}`,
	});
	const review = structuredClone(
		(value as { review: Detail }).review
	) as Detail & {
		proof: Detail;
		certificate: Detail;
	};
	review.id = id;
	review.title = title;
	review.proof.plan_hash = planHash;
	review.certificate.plan_hash = planHash;
	return review;
}

function deferred<T>() {
	let resolve: (value: T) => void = () => undefined;
	const promise = new Promise<T>((settle) => {
		resolve = settle;
	});
	return { promise, resolve };
}

function buttonNamed(name: string): HTMLButtonElement | undefined {
	return [...(host?.querySelectorAll("button") ?? [])].find((button) =>
		button.textContent?.includes(name)
	);
}

async function click(button: HTMLButtonElement | undefined) {
	if (!button) {
		throw new Error("expected button is not rendered");
	}
	await act(async () => {
		button.click();
		await Promise.resolve();
	});
}

async function settle() {
	await act(async () => {
		for (let tick = 0; tick < 5; tick += 1) {
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	});
}

describe("review selection", () => {
	test("a stale review A can never approve review B while B is still loading", async () => {
		const reviewA = await reviewAs(
			"review-a",
			"Plan A: publish docs",
			PLAN_HASH_A
		);
		const reviewB = await reviewAs(
			"review-b",
			"Plan B: wipe bucket",
			PLAN_HASH_B
		);
		const reviewBResponse = deferred<SafeActionsRequestValue>();
		const decisions: SafeActionsRequest[] = [];
		setRequesterForTests(async (request) => {
			if (request.method === "POST") {
				decisions.push(request);
				return { status: "approved", message: "Approval recorded." };
			}
			if (request.path === "/reviews") {
				return {
					reviews: [reviewA, reviewB].map((review) => ({
						id: review.id,
						title: review.title,
						status: "pending",
						created_at: review.created_at,
						policy_name: review.policy_name,
						node_count: review.node_count,
					})),
				};
			}
			if (request.path === "/reviews/review-a") {
				return { review: reviewA };
			}
			if (request.path === "/reviews/review-b") {
				return reviewBResponse.promise;
			}
			return proofFixtureRequest(request);
		});

		host = document.createElement("div");
		document.body.append(host);
		root = createRoot(host);
		await act(async () => root?.render(<Reviews />));
		await settle();
		expect(host.textContent).toContain("Plan A: publish docs");

		// Open A's approval confirmation, then pick B before B's detail arrives.
		await click(buttonNamed("Approve exact plan"));
		expect(buttonNamed("Confirm & resume plan")).toBeDefined();
		await click(buttonNamed("Plan B: wipe bucket"));

		// A's plan and its armed confirmation are gone the moment B is selected,
		// so nothing on screen can send a decision for B.
		const workspace = host.querySelector("main");
		expect(workspace?.textContent).not.toContain("Plan A: publish docs");
		expect(buttonNamed("Confirm & resume plan")).toBeUndefined();
		expect(buttonNamed("Approve exact plan")).toBeUndefined();
		expect(decisions).toEqual([]);

		// Once B is displayed, its own confirmation binds B's id and plan hash.
		await act(async () => reviewBResponse.resolve({ review: reviewB }));
		await settle();
		expect(workspace?.textContent).toContain("Plan B: wipe bucket");
		await click(buttonNamed("Approve exact plan"));
		await click(buttonNamed("Confirm & resume plan"));
		await settle();
		expect(decisions).toEqual([
			{
				method: "POST",
				path: "/reviews/review-b/approve",
				body: { expected_plan_hash: PLAN_HASH_B },
			},
		]);
		// The decided review stays on screen (now closed) after the queue reloads.
		expect(workspace?.textContent).toContain("Plan B: wipe bucket");
		expect(workspace?.textContent).toContain("decision is immutable");
	});
});
