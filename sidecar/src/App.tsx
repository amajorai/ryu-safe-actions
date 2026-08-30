import { useEffect, useState } from "react";
import { isProofFixtureMode } from "./api.ts";
import { Policies } from "./Policies.tsx";
import { Receipts } from "./Receipts.tsx";
import { Reviews } from "./Reviews.tsx";

type Surface = "policies" | "reviews" | "receipts";

const SURFACES: Array<{ id: Surface; label: string }> = [
	{ id: "policies", label: "Policies" },
	{ id: "reviews", label: "Reviews" },
	{ id: "receipts", label: "Receipts" },
];

function initialSurface(): Surface {
	if (typeof window === "undefined") {
		return "reviews";
	}
	const requested =
		window.ryu?.context?.surface ??
		new URLSearchParams(window.location.search).get("view");
	return SURFACES.some(({ id }) => id === requested)
		? (requested as Surface)
		: "reviews";
}

export function App() {
	const [surface] = useState<Surface>(initialSurface);
	const proofMode = isProofFixtureMode();
	useEffect(() => {
		document.title = `${SURFACES.find(({ id }) => id === surface)?.label ?? "Safe Actions"} · Safe Actions`;
		const url = new URL(window.location.href);
		url.searchParams.set("view", surface);
		window.history.replaceState(window.history.state, "", url);
	}, [surface]);

	return (
		<div className="sa-app">
			<a className="sa-skip-link" href="#safe-actions-main">
				Skip to main content
			</a>
			<header className="sa-topbar">
				<div className="sa-brand">
					<span aria-hidden="true" className="sa-brand-mark">
						SA
					</span>
					<div>
						<strong>Safe Actions</strong>
						<span>Verified execution control</span>
					</div>
				</div>
				<div className="sa-core-state">
					<span
						aria-hidden="true"
						className={`sa-live-dot ${proofMode ? "proof" : ""}`}
					/>
					<span>{proofMode ? "Proof fixture" : "Core governed"}</span>
				</div>
			</header>
			{proofMode ? (
				<div className="sa-proof-banner" role="status">
					<strong>Deterministic proof mode</strong>
					<span>
						Local fixtures are active only because this URL includes{" "}
						<code>?proof=1</code>. No tool can execute.
					</span>
				</div>
			) : null}
			<div className="sa-surface" key={surface}>
				{surface === "policies" ? <Policies /> : null}
				{surface === "reviews" ? <Reviews /> : null}
				{surface === "receipts" ? <Receipts /> : null}
			</div>
		</div>
	);
}
