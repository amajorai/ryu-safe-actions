import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { decideReview, getReview, listReviews } from "./api.ts";
import { HashLedger } from "./HashLedger.tsx";
import { countCalls, effectsOf, formatTime, resourcesOf } from "./model.ts";
import { PlanTree } from "./PlanTree.tsx";
import {
	EmptyState,
	ErrorBanner,
	LoadingState,
	SuccessBanner,
} from "./SurfaceStates.tsx";
import type { Finding, ReviewDetail, ReviewSummary } from "./types.ts";

function errorText(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function FindingItem({ finding }: { finding: Finding }) {
	return (
		<li className={`sa-finding ${finding.severity}`}>
			<div className="sa-finding-head">
				<span className="sa-finding-level">{finding.severity}</span>
				<code>{finding.code}</code>
			</div>
			<strong>{finding.title ?? finding.message}</strong>
			{finding.title ? <p>{finding.message}</p> : null}
			{finding.node_id ? (
				<span className="sa-finding-node">Node · {finding.node_id}</span>
			) : null}
			{finding.counterexample ? (
				<details className="sa-counterexample">
					<summary>Deterministic counterexample</summary>
					<pre>
						{typeof finding.counterexample === "string"
							? finding.counterexample
							: JSON.stringify(finding.counterexample, null, 2)}
					</pre>
				</details>
			) : null}
		</li>
	);
}

function ReviewDecision({
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
		<div className="sa-review-bar">
			<label className="sa-field sa-review-note">
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
				className="sa-review-actions"
				role={confirmDeny || confirmApprove ? "status" : undefined}
			>
				{confirmDeny ? (
					<>
						<button
							className="sa-button danger"
							disabled={busy}
							onClick={() => onDecide("deny", note)}
							ref={denyConfirmRef}
							type="button"
						>
							Confirm denial
						</button>
						<button
							className="sa-button quiet"
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
						className="sa-button danger quiet"
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
							className="sa-button primary"
							disabled={busy}
							onClick={() => onDecide("approve", note)}
							ref={approveConfirmRef}
							type="button"
						>
							{busy ? "Resuming…" : "Confirm & resume plan"}
						</button>
						<button
							className="sa-button quiet"
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
						className="sa-button primary"
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
			<p className="sa-review-disclaimer">
				Approval records a decision and resumes the persisted Core plan. This
				Companion never invokes tools directly.
			</p>
		</div>
	);
}

function ReviewWorkspace({
	busy,
	detail,
	onDecide,
}: {
	busy: boolean;
	detail: ReviewDetail;
	onDecide: (decision: "approve" | "deny", note: string) => void;
}) {
	const effects = useMemo(() => effectsOf(detail.plan), [detail.plan]);
	const resources = useMemo(() => resourcesOf(detail.plan), [detail.plan]);
	const calls = useMemo(() => countCalls(detail.plan), [detail.plan]);
	const proof = detail.certificate ?? detail.proof;
	return (
		<div className="sa-review-workspace">
			<header className="sa-detail-header">
				<div>
					<span className="sa-eyebrow">Awaiting human judgment</span>
					<h1>{detail.title}</h1>
					<p>
						{detail.review_reason ??
							"Policy rules require review before execution."}
					</p>
				</div>
				<span className={`sa-status ${detail.status}`}>{detail.status}</span>
			</header>

			<div aria-label="Plan summary" className="sa-plan-metrics">
				<div>
					<strong>{detail.node_count ?? calls}</strong>
					<span>nodes</span>
				</div>
				<div>
					<strong>{calls}</strong>
					<span>tool calls</span>
				</div>
				<div>
					<strong>{effects.length}</strong>
					<span>effects</span>
				</div>
				<div>
					<strong>{detail.findings.length}</strong>
					<span>findings</span>
				</div>
			</div>

			<section className="sa-review-section">
				<div className="sa-review-section-head">
					<div>
						<span className="sa-step-number">01</span>
						<h2>Typed plan</h2>
					</div>
					<div className="sa-token-row">
						{effects.map((effect) => (
							<span className={`sa-token effect-${effect}`} key={effect}>
								{effect}
							</span>
						))}
					</div>
				</div>
				<PlanTree findings={detail.findings} plan={detail.plan} />
				{resources.length > 0 ? (
					<div className="sa-resources">
						<strong>Declared resources</strong>
						<div>
							{resources.map((resource) => (
								<code key={resource}>{resource}</code>
							))}
						</div>
					</div>
				) : null}
			</section>

			<section className="sa-review-section">
				<div className="sa-review-section-head">
					<div>
						<span className="sa-step-number">02</span>
						<h2>Verifier findings</h2>
					</div>
					<span className="sa-muted">Deterministic · no model verdict</span>
				</div>
				{detail.findings.length === 0 ? (
					<EmptyState
						detail="The verifier found no policy exceptions."
						title="No findings"
					/>
				) : (
					<ul className="sa-findings-list">
						{detail.findings.map((finding) => (
							<FindingItem
								finding={finding}
								key={finding.id ?? `${finding.code}-${finding.node_id}`}
							/>
						))}
					</ul>
				)}
			</section>

			<section className="sa-review-section">
				<div className="sa-review-section-head">
					<div>
						<span className="sa-step-number">03</span>
						<h2>Proof binding</h2>
					</div>
					<span className="sa-muted">
						Created {formatTime(detail.created_at)}
					</span>
				</div>
				<HashLedger hashes={proof} />
				{detail.certificate?.expires_at ? (
					<p className="sa-expiry">
						Certificate expires {formatTime(detail.certificate.expires_at)}. Any
						plan, policy, catalog, or verifier change invalidates it first.
					</p>
				) : null}
			</section>

			{detail.status === "pending" && detail.reviewable === false ? (
				<div className="sa-inline-findings error" role="alert">
					<strong>Approval unavailable</strong>
					<p>
						{detail.review_block_reason ??
							"Core returned incomplete verification evidence."}
					</p>
				</div>
			) : detail.status === "pending" ? (
				<ReviewDecision busy={busy} key={detail.id} onDecide={onDecide} />
			) : (
				<div className="sa-closed-decision">
					This review is {detail.status}; its decision is immutable.
				</div>
			)}
		</div>
	);
}

export function Reviews() {
	const [reviews, setReviews] = useState<ReviewSummary[]>([]);
	const [selectedId, setSelectedId] = useState<string | undefined>(() =>
		typeof window === "undefined" ? undefined : window.ryu?.context?.reviewId
	);
	const [detail, setDetail] = useState<ReviewDetail>();
	const [detailRevision, setDetailRevision] = useState(0);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string>();
	const [success, setSuccess] = useState<string>();
	const workspaceRef = useRef<HTMLElement>(null);
	const focusWorkspaceAfterLoad = useRef(false);

	const loadList = useCallback(async () => {
		setLoading(true);
		try {
			const next = await listReviews();
			setReviews(next);
			setSelectedId((current) =>
				current && next.some((item) => item.id === current)
					? current
					: next[0]?.id
			);
			setError(undefined);
		} catch (cause) {
			setReviews([]);
			setSelectedId(undefined);
			setDetail(undefined);
			setError(errorText(cause));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadList();
	}, [loadList]);
	useEffect(() => {
		if (!selectedId) {
			setDetail(undefined);
			return;
		}
		setLoading(true);
		let active = true;
		getReview(selectedId)
			.then((next) => {
				if (active) {
					setDetail(next);
					setError(undefined);
					if (focusWorkspaceAfterLoad.current) {
						focusWorkspaceAfterLoad.current = false;
						requestAnimationFrame(() => workspaceRef.current?.focus());
					}
				}
			})
			.catch((cause: unknown) => {
				if (active) {
					setDetail(undefined);
					setError(errorText(cause));
				}
			})
			.finally(() => {
				if (active) {
					setLoading(false);
				}
			});
		return () => {
			active = false;
		};
	}, [detailRevision, selectedId]);

	const decide = async (decision: "approve" | "deny", note: string) => {
		if (!selectedId) {
			return;
		}
		setBusy(true);
		try {
			const result = await decideReview(selectedId, decision, note);
			setSuccess(
				result.message ??
					(decision === "approve"
						? "Approval recorded. Core will resume the persisted plan."
						: "Denial recorded. The plan cannot execute.")
			);
			setDetail((current) =>
				current
					? {
							...current,
							status: decision === "approve" ? "approved" : "denied",
						}
					: current
			);
			await loadList();
			requestAnimationFrame(() => workspaceRef.current?.focus());
		} catch (cause) {
			setDetail(undefined);
			await loadList();
			setDetailRevision((revision) => revision + 1);
			setError(errorText(cause));
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="sa-surface-grid">
			<aside aria-label="Review queue" className="sa-rail">
				<div className="sa-rail-head">
					<div>
						<span className="sa-eyebrow">Human gate</span>
						<h1>Reviews</h1>
					</div>
					<button
						className="sa-button compact quiet"
						disabled={loading}
						onClick={() =>
							void loadList().then(() =>
								setDetailRevision((revision) => revision + 1)
							)
						}
						type="button"
					>
						Refresh
					</button>
				</div>
				<div className="sa-queue-tally">
					<strong>
						{reviews.filter((item) => item.status === "pending").length}
					</strong>
					<span>pending exact-plan decisions</span>
				</div>
				{loading && reviews.length === 0 ? (
					<LoadingState label="Loading reviews" />
				) : null}
				{!loading && reviews.length === 0 ? (
					<EmptyState
						detail="Plans allowed without review execute through Core; plans denied by policy never enter this queue."
						title="Review queue clear"
					/>
				) : null}
				<ul className="sa-list">
					{reviews.map((item) => (
						<li key={item.id}>
							<button
								aria-current={item.id === selectedId ? "page" : undefined}
								className={`sa-list-row ${item.id === selectedId ? "selected" : ""}`}
								onClick={() => {
									focusWorkspaceAfterLoad.current = true;
									setSelectedId(item.id);
									setSuccess(undefined);
								}}
								type="button"
							>
								<span className="sa-list-overline">
									<span className={`sa-status ${item.status}`}>
										{item.status}
									</span>
									<span>{formatTime(item.created_at)}</span>
								</span>
								<span className="sa-list-title">{item.title}</span>
								<span className="sa-list-summary">
									{item.policy_name ?? "Unbound policy"} ·{" "}
									{item.node_count ?? "—"} nodes
								</span>
							</button>
						</li>
					))}
				</ul>
			</aside>
			<main
				className="sa-workspace"
				id="safe-actions-main"
				ref={workspaceRef}
				tabIndex={-1}
			>
				{error ? <ErrorBanner message={error} /> : null}
				{success ? <SuccessBanner message={success} /> : null}
				{loading && !detail ? (
					<LoadingState label="Loading verified plan" />
				) : null}
				{detail ? (
					<ReviewWorkspace
						busy={busy}
						detail={detail}
						onDecide={(decision, note) => void decide(decision, note)}
					/>
				) : loading ? null : (
					<EmptyState
						detail="Select a queued plan to inspect every typed node, finding, and proof hash."
						title="Select a review"
					/>
				)}
			</main>
		</div>
	);
}
