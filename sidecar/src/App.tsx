import { useEffect, useState } from "react";
import { z } from "zod";
import { isProofFixtureMode } from "./api.ts";
import { Policies } from "./Policies.tsx";
import { Receipts } from "./Receipts.tsx";
import { Reviews } from "./Reviews.tsx";
import { tl, useI18nRevision } from "./ryu-i18n.ts";
import styles from "./safe-actions.module.css";

const SURFACE_IDS = ["policies", "reviews", "receipts"] as const;

type Surface = (typeof SURFACE_IDS)[number];

/** The host-language label of one Companion surface. */
export function surfaceLabel(surface: Surface): string {
	switch (surface) {
		case "policies":
			return tl("Policies");
		case "receipts":
			return tl("Receipts");
		default:
			return tl("Reviews");
	}
}

function initialSurface(): Surface {
	if (!("window" in globalThis)) {
		return "reviews";
	}
	const requested =
		window.ryu?.context?.surface ??
		new URLSearchParams(window.location.search).get("view");
	return z.enum(SURFACE_IDS).catch("reviews").parse(requested);
}

export function App() {
	const [surface] = useState<Surface>(initialSurface);
	const proofMode = isProofFixtureMode();
	useI18nRevision();
	const title = tl("{surface} · Safe Actions", {
		surface: surfaceLabel(surface),
	});
	useEffect(() => {
		document.title = title;
	}, [title]);
	useEffect(() => {
		const url = new URL(window.location.href);
		url.searchParams.set("view", surface);
		window.history.replaceState(window.history.state, "", url);
	}, [surface]);

	return (
		<div className={styles["sa-app"]}>
			<a className={styles["sa-skip-link"]} href="#safe-actions-main">
				Skip to main content
			</a>
			<header className={styles["sa-topbar"]}>
				<div className={styles["sa-brand"]}>
					<span aria-hidden="true" className={styles["sa-brand-mark"]}>
						SA
					</span>
					<div>
						<strong>Safe Actions</strong>
						<span>Verified execution control</span>
					</div>
				</div>
				<div className={styles["sa-core-state"]}>
					<span
						aria-hidden="true"
						className={`${styles["sa-live-dot"]} ${proofMode ? styles.proof : ""}`}
					/>
					<span>{proofMode ? "Proof fixture" : "Core governed"}</span>
				</div>
			</header>
			{proofMode ? (
				<div className={styles["sa-proof-banner"]} role="status">
					<strong>Deterministic proof mode</strong>
					<span>
						Local fixtures are active only because this URL includes{" "}
						<code>?proof=1</code>. No tool can execute.
					</span>
				</div>
			) : null}
			<div className={styles["sa-surface"]} key={surface}>
				{surface === "policies" ? <Policies /> : null}
				{surface === "reviews" ? <Reviews /> : null}
				{surface === "receipts" ? <Receipts /> : null}
			</div>
		</div>
	);
}
