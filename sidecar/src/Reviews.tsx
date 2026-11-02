import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { decideReview, getReview, listReviews } from "./api.ts";
import { HashLedger } from "./HashLedger.tsx";
import { countCalls, effectsOf, formatTime, resourcesOf } from "./model.ts";
import { PlanTree } from "./PlanTree.tsx";
import { FindingItem, ReviewDecision } from "./ReviewDecision.tsx";
import { tl } from "./ryu-i18n.ts";
import {
	EmptyState,
	ErrorBanner,
	LoadingState,
	SuccessBanner,
} from "./SurfaceStates.tsx";
import styles from "./safe-actions.module.css";
import type { ReviewDetail, ReviewSummary } from "./types.ts";

function errorText(error: Parameters<typeof String>[0]): string {
	return error instanceof Error ? error.message : String(error);
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
		<div className={styles["sa-review-workspace"]}>
			<header className={styles["sa-detail-header"]}>
				<div>
					<h1>{detail.title}</h1>
					<p>
						{detail.review_reason ??
							"Policy rules require review before execution."}
					</p>
				</div>
				<span className={`${styles["sa-status"]} ${styles[detail.status]}`}>
					{detail.status}
				</span>
			</header>

			<div aria-label="Plan summary" className={styles["sa-plan-metrics"]}>
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

			<section className={styles["sa-review-section"]}>
				<div className={styles["sa-review-section-head"]}>
					<div>
						<span className={styles["sa-step-number"]}>01</span>
						<h2>Typed plan</h2>
					</div>
					<div className={styles["sa-token-row"]}>
						{effects.map((effect) => (
							<span
								className={`${styles["sa-token"]} ${styles[`effect-${effect}`]}`}
								key={effect}
							>
								{effect}
							</span>
						))}
					</div>
				</div>
				<PlanTree findings={detail.findings} plan={detail.plan} />
				{resources.length > 0 ? (
					<div className={styles["sa-resources"]}>
						<strong>Declared resources</strong>
						<div>
							{resources.map((resource) => (
								<code key={resource}>{resource}</code>
							))}
						</div>
					</div>
				) : null}
			</section>

			<section className={styles["sa-review-section"]}>
				<div className={styles["sa-review-section-head"]}>
					<div>
						<span className={styles["sa-step-number"]}>02</span>
						<h2>Verifier findings</h2>
					</div>
					<span className={styles["sa-muted"]}>
						Deterministic · no model verdict
					</span>
				</div>
				{detail.findings.length === 0 ? (
					<EmptyState
						detail="The verifier found no policy exceptions."
						title="No findings"
					/>
				) : (
					<ul className={styles["sa-findings-list"]}>
						{detail.findings.map((finding) => (
							<FindingItem
								finding={finding}
								key={finding.id ?? `${finding.code}-${finding.node_id}`}
							/>
						))}
					</ul>
				)}
			</section>

			<section className={styles["sa-review-section"]}>
				<div className={styles["sa-review-section-head"]}>
					<div>
						<span className={styles["sa-step-number"]}>03</span>
						<h2>Proof binding</h2>
					</div>
					<span className={styles["sa-muted"]}>
						{tl("Created {time}", { time: formatTime(detail.created_at) })}
					</span>
				</div>
				<HashLedger hashes={proof} />
				{detail.certificate?.expires_at ? (
					<p className={styles["sa-expiry"]}>
						{tl(
							"Certificate expires {time}. Any plan, policy, catalog, or verifier change invalidates it first.",
							{ time: formatTime(detail.certificate.expires_at) }
						)}
					</p>
				) : null}
			</section>

			{detail.status === "pending" && detail.reviewable === false ? (
				<div
					className={`${styles["sa-inline-findings"]} ${styles.error}`}
					role="alert"
				>
					<strong>Approval unavailable</strong>
					<p>
						{detail.review_block_reason ??
							"Core returned incomplete verification evidence."}
					</p>
				</div>
			) : detail.status === "pending" ? (
				<ReviewDecision busy={busy} key={detail.id} onDecide={onDecide} />
			) : (
				<div className={styles["sa-closed-decision"]}>
					{tl(
						"{status, select, approved {This review is approved; its decision is immutable.} denied {This review is denied; its decision is immutable.} executing {This review is executing; its decision is immutable.} closed {This review is closed; its decision is immutable.} expired {This review is expired; its decision is immutable.} other {This review is {status}; its decision is immutable.}}",
						{ status: detail.status }
					)}
				</div>
			)}
		</div>
	);
}

export function Reviews() {
	const [reviews, setReviews] = useState<ReviewSummary[]>([]);
	const [selectedId, setSelectedId] = useState<string | undefined>(() =>
		"window" in globalThis ? window.ryu?.context?.reviewId : undefined
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
		// The loaded detail is not cleared here: a list reload keeps the same
		// selection, so clearing would strand the workspace empty (the detail
		// effect only reruns on a selection or revision change). A selection that
		// does change clears the old detail in that effect, before any await.
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
		// A selection change invalidates the old review immediately. Leaving its
		// controls mounted while the next detail loads can display review A while
		// the decision path already points at review B.
		setDetail(undefined);
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

	const decide = async (
		displayed: ReviewDetail,
		decision: "approve" | "deny",
		note: string
	) => {
		if (selectedId !== displayed.id || detail?.id !== displayed.id) {
			setError(
				"The selected review changed. Inspect the newly loaded plan first."
			);
			return;
		}
		const expectedPlanHash =
			displayed.proof?.plan_hash ?? displayed.certificate?.plan_hash;
		if (!expectedPlanHash) {
			setError(
				"Core did not provide the plan hash required to bind this decision."
			);
			return;
		}
		setBusy(true);
		try {
			const result = await decideReview(
				displayed.id,
				decision,
				expectedPlanHash,
				note
			);
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
	const displayedDetail = detail?.id === selectedId ? detail : undefined;

	return (
		<div className={styles["sa-surface-grid"]}>
			<aside aria-label="Review queue" className={styles["sa-rail"]}>
				<div className={styles["sa-rail-head"]}>
					<div>
						<h1>Reviews</h1>
					</div>
					<button
						className={`${styles["sa-button"]} ${styles.compact} ${styles.quiet}`}
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
				<div className={styles["sa-queue-tally"]}>
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
				<ul className={styles["sa-list"]}>
					{reviews.map((item) => (
						<li key={item.id}>
							<button
								aria-current={item.id === selectedId ? "page" : undefined}
								className={`${styles["sa-list-row"]} ${item.id === selectedId ? styles.selected : ""}`}
								disabled={busy}
								onClick={() => {
									focusWorkspaceAfterLoad.current = true;
									setDetail(undefined);
									setSelectedId(item.id);
									setSuccess(undefined);
								}}
								type="button"
							>
								<span className={styles["sa-list-overline"]}>
									<span
										className={`${styles["sa-status"]} ${styles[item.status]}`}
									>
										{item.status}
									</span>
									<span>{formatTime(item.created_at)}</span>
								</span>
								<span className={styles["sa-list-title"]}>{item.title}</span>
								<span className={styles["sa-list-summary"]}>
									{item.node_count === undefined
										? tl("{policy} · — nodes", {
												policy: item.policy_name ?? tl("Unbound policy"),
											})
										: tl(
												"{policy} · {count, plural, one {# node} other {# nodes}}",
												{
													count: item.node_count,
													policy: item.policy_name ?? tl("Unbound policy"),
												}
											)}
								</span>
							</button>
						</li>
					))}
				</ul>
			</aside>
			<main
				className={styles["sa-workspace"]}
				id="safe-actions-main"
				ref={workspaceRef}
				tabIndex={-1}
			>
				{error ? <ErrorBanner message={error} /> : null}
				{success ? <SuccessBanner message={success} /> : null}
				{loading && !displayedDetail ? (
					<LoadingState label="Loading verified plan" />
				) : null}
				{displayedDetail ? (
					<ReviewWorkspace
						busy={busy}
						detail={displayedDetail}
						onDecide={(decision, note) =>
							void decide(displayedDetail, decision, note)
						}
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
