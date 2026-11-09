import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { tl } from "./ryu-i18n.ts";
import styles from "./safe-actions.module.css";
import type { Finding } from "./types.ts";

export function FindingItem({ finding }: { finding: Finding }) {
	return (
		<li className={`${styles["sa-finding"]} ${styles[finding.severity]}`}>
			<div className={styles["sa-finding-head"]}>
				<span className={styles["sa-finding-level"]}>{finding.severity}</span>
				<code>{finding.code}</code>
			</div>
			<strong>{finding.title ?? finding.message}</strong>
			{finding.title ? <p>{finding.message}</p> : null}
			{finding.node_id ? (
				<span className={styles["sa-finding-node"]}>
					{tl("Node · {node}", { node: finding.node_id })}
				</span>
			) : null}
			{finding.counterexample ? (
				<details className={styles["sa-counterexample"]}>
					<summary>Deterministic counterexample</summary>
					<pre>
						{z.string().safeParse(finding.counterexample).success
							? z.string().parse(finding.counterexample)
							: JSON.stringify(finding.counterexample, null, 2)}
					</pre>
				</details>
			) : null}
		</li>
	);
}

export function ReviewDecision({
	busy,
	onDecide,
}: {
	busy: boolean;
	onDecide: (decision: "approve" | "deny", note: string) => void;
}) {
	const [note, setNote] = useState("");
	const [confirmDeny, setConfirmDeny] = useState(false);
	const [confirmApprove, setConfirmApprove] = useState(false);
	const denyTriggerRef = useRef<HTMLButtonElement>(null);
	const approveTriggerRef = useRef<HTMLButtonElement>(null);
	const denyConfirmRef = useRef<HTMLButtonElement>(null);
	const approveConfirmRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		if (confirmDeny) {
			denyConfirmRef.current?.focus();
		} else if (confirmApprove) {
			approveConfirmRef.current?.focus();
		}
	}, [confirmApprove, confirmDeny]);
	return (
		<div className={styles["sa-review-bar"]}>
			<label className={`${styles["sa-field"]} ${styles["sa-review-note"]}`}>
				<span>
					Decision note <small>optional</small>
				</span>
				<input
					autoComplete="off"
					maxLength={4096}
					name="review-note"
					onChange={(event) => setNote(event.target.value)}
					placeholder="Why this exact plan is safe—or why it is not"
					value={note}
				/>
			</label>
			<div
				aria-label="Review decision confirmation"
				className={styles["sa-review-actions"]}
				role={confirmDeny || confirmApprove ? "status" : undefined}
			>
				{confirmDeny ? (
					<>
						<button
							className={`${styles["sa-button"]} ${styles.danger}`}
							disabled={busy}
							onClick={() => onDecide("deny", note)}
							ref={denyConfirmRef}
							type="button"
						>
							Confirm denial
						</button>
						<button
							className={`${styles["sa-button"]} ${styles.quiet}`}
							onClick={() => {
								setConfirmDeny(false);
								requestAnimationFrame(() => denyTriggerRef.current?.focus());
							}}
							type="button"
						>
							Cancel
						</button>
					</>
				) : (
					<button
						className={`${styles["sa-button"]} ${styles.danger} ${styles.quiet}`}
						disabled={busy}
						onClick={() => {
							setConfirmApprove(false);
							setConfirmDeny(true);
						}}
						ref={denyTriggerRef}
						type="button"
					>
						Deny plan
					</button>
				)}
				{confirmApprove ? (
					<>
						<button
							className={`${styles["sa-button"]} ${styles.primary}`}
							disabled={busy}
							onClick={() => onDecide("approve", note)}
							ref={approveConfirmRef}
							type="button"
						>
							{busy ? "Resuming…" : "Confirm & resume plan"}
						</button>
						<button
							className={`${styles["sa-button"]} ${styles.quiet}`}
							disabled={busy}
							onClick={() => {
								setConfirmApprove(false);
								requestAnimationFrame(() => approveTriggerRef.current?.focus());
							}}
							type="button"
						>
							Cancel
						</button>
					</>
				) : (
					<button
						className={`${styles["sa-button"]} ${styles.primary}`}
						disabled={busy}
						onClick={() => {
							setConfirmDeny(false);
							setConfirmApprove(true);
						}}
						ref={approveTriggerRef}
						type="button"
					>
						Approve exact plan
					</button>
				)}
			</div>
			<p className={styles["sa-review-disclaimer"]}>
				Approval records a decision and resumes the persisted Core plan. This
				Companion never invokes tools directly.
			</p>
		</div>
	);
}
