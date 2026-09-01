import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getReceipt, listReceipts } from "./api.ts";
import { HashLedger } from "./HashLedger.tsx";
import { formatTime, safeJson } from "./model.ts";
import { EmptyState, ErrorBanner, LoadingState } from "./SurfaceStates.tsx";
import type { ReceiptDetail, ReceiptSummary } from "./types.ts";

function errorText(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function duration(start?: string, end?: string): string {
	if (!(start && end)) {
		return "—";
	}
	const milliseconds = new Date(end).getTime() - new Date(start).getTime();
	if (!Number.isFinite(milliseconds) || milliseconds < 0) {
		return "—";
	}
	return milliseconds < 1000
		? `${milliseconds} ms`
		: `${(milliseconds / 1000).toFixed(2)} s`;
}

function ReceiptDetailView({ receipt }: { receipt: ReceiptDetail }) {
	const download = `data:application/json;charset=utf-8,${encodeURIComponent(safeJson(receipt))}`;
	return (
		<div className="sa-receipt-workspace">
			<header className="sa-detail-header">
				<div>
					<span className="sa-eyebrow">Immutable execution record</span>
					<h1>{receipt.title}</h1>
					<p>
						Started {formatTime(receipt.started_at)} ·{" "}
						{duration(receipt.started_at, receipt.finished_at)}
					</p>
				</div>
				<div className="sa-detail-actions">
					<span className={`sa-status ${receipt.status}`}>
						{receipt.status}
					</span>
					<a
						className="sa-button quiet"
						download={`${receipt.id}.json`}
						href={download}
					>
						Download JSON
					</a>
				</div>
			</header>

			{receipt.uncertain_after_crash || receipt.status === "uncertain" ? (
				<div className="sa-crash-warning" role="alert">
					<span className="sa-crash-code">?</span>
					<div>
						<strong>
							{receipt.uncertain_after_crash
								? "Uncertain after crash"
								: "Outcome uncertain"}
						</strong>
						<p>
							{receipt.error ??
								"Core could not prove whether the in-flight tool completed. Automatic replay is disabled."}
						</p>
						<span>
							Inspect the target system before retrying. A retry must be
							submitted as a new plan.
						</span>
					</div>
				</div>
			) : receipt.error ? (
				<div className="sa-banner error" role="alert">
					<strong>Execution error</strong>
					<span>{receipt.error}</span>
				</div>
			) : null}

			<section className="sa-receipt-section">
				<div className="sa-review-section-head">
					<div>
						<span className="sa-step-number">01</span>
						<h2>Step timeline</h2>
					</div>
					<span className="sa-muted">Arguments and results are hash-only</span>
				</div>
				<ol className="sa-timeline">
					{receipt.steps.map((step) => (
						<li className={`sa-timeline-step ${step.status}`} key={step.id}>
							<div className="sa-timeline-marker">
								<span>{step.index}</span>
							</div>
							<div className="sa-timeline-body">
								<div className="sa-timeline-head">
									<div>
										<span className="sa-tree-kicker">Tool call</span>
										<strong>{step.tool}</strong>
									</div>
									<span className={`sa-status ${step.status}`}>
										{step.status}
									</span>
								</div>
								<div className="sa-timeline-meta">
									<span>{formatTime(step.started_at)}</span>
									<span>{duration(step.started_at, step.finished_at)}</span>
								</div>
								{step.resources && step.resources.length > 0 ? (
									<div className="sa-resource-line">
										{step.resources.join(" · ")}
									</div>
								) : null}
								<dl className="sa-step-hashes">
									<div>
										<dt>Arguments</dt>
										<dd>
											<code className="sa-full-hash">
												{step.arguments_hash ??
													step.argument_hash ??
													"Unavailable"}
											</code>
										</dd>
									</div>
									<div>
										<dt>Result</dt>
										<dd>
											<code className="sa-full-hash">
												{step.result_hash ?? "Unavailable"}
											</code>
										</dd>
									</div>
								</dl>
								{step.error ? (
									<p className="sa-step-error">{step.error}</p>
								) : null}
							</div>
						</li>
					))}
				</ol>
			</section>

			<section className="sa-receipt-section">
				<div className="sa-review-section-head">
					<div>
						<span className="sa-step-number">02</span>
						<h2>Proof lineage</h2>
					</div>
					<span className="sa-muted">
						{receipt.policy_name ?? receipt.policy_id ?? "Policy unavailable"}
					</span>
				</div>
				<HashLedger hashes={receipt.certificate ?? receipt.proof} />
			</section>
		</div>
	);
}

export function Receipts() {
	const [receipts, setReceipts] = useState<ReceiptSummary[]>([]);
	const [selectedId, setSelectedId] = useState<string | undefined>(() =>
		typeof window === "undefined" ? undefined : window.ryu?.context?.receiptId
	);
	const [detail, setDetail] = useState<ReceiptDetail>();
	const [detailRevision, setDetailRevision] = useState(0);
	const [query, setQuery] = useState("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string>();
	const workspaceRef = useRef<HTMLElement>(null);
	const focusWorkspaceAfterLoad = useRef(false);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const next = await listReceipts();
			setReceipts(next);
			setSelectedId((current) =>
				current && next.some((item) => item.id === current)
					? current
					: next[0]?.id
			);
			setError(undefined);
		} catch (cause) {
			setReceipts([]);
			setSelectedId(undefined);
			setDetail(undefined);
			setError(errorText(cause));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);
	useEffect(() => {
		if (!selectedId) {
			setDetail(undefined);
			return;
		}
		setLoading(true);
		let active = true;
		getReceipt(selectedId)
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

	const filtered = useMemo(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) {
			return receipts;
		}
		return receipts.filter((receipt) =>
			[receipt.id, receipt.title, receipt.status, receipt.policy_name]
				.filter(Boolean)
				.some((value) => value?.toLowerCase().includes(needle))
		);
	}, [query, receipts]);

	return (
		<div className="sa-surface-grid">
			<aside aria-label="Execution receipts" className="sa-rail">
				<div className="sa-rail-head">
					<div>
						<span className="sa-eyebrow">Audit trail</span>
						<h1>Receipts</h1>
					</div>
					<button
						className="sa-button compact quiet"
						disabled={loading}
						onClick={() =>
							void load().then(() =>
								setDetailRevision((revision) => revision + 1)
							)
						}
						type="button"
					>
						Refresh
					</button>
				</div>
				<label className="sa-search">
					<span className="sa-sr-only">Search receipts</span>
					<input
						autoComplete="off"
						name="receipt-search"
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Search id, title, policy, or status…"
						type="search"
						value={query}
					/>
				</label>
				{loading && receipts.length === 0 ? (
					<LoadingState label="Loading receipts" />
				) : null}
				{!loading && receipts.length === 0 ? (
					<EmptyState
						detail="Core writes a receipt when a certified plan enters execution."
						title="No executions yet"
					/>
				) : null}
				{!loading && receipts.length > 0 && filtered.length === 0 ? (
					<EmptyState
						detail="Try a different id, title, policy, or status."
						title="No matching receipts"
					/>
				) : null}
				<p className="sa-sr-only" role="status">
					{filtered.length} receipt results
				</p>
				<ul className="sa-list">
					{filtered.map((receipt) => (
						<li key={receipt.id}>
							<button
								aria-current={receipt.id === selectedId ? "page" : undefined}
								className={`sa-list-row ${receipt.id === selectedId ? "selected" : ""}`}
								onClick={() => {
									focusWorkspaceAfterLoad.current = true;
									setSelectedId(receipt.id);
								}}
								type="button"
							>
								<span className="sa-list-overline">
									<span className={`sa-status ${receipt.status}`}>
										{receipt.status}
									</span>
									<span>{formatTime(receipt.started_at)}</span>
								</span>
								<span className="sa-list-title">{receipt.title}</span>
								<span className="sa-list-summary">
									{receipt.policy_name ?? "Policy unavailable"} ·{" "}
									{receipt.tool_count ?? 0} tools
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
				{loading && !detail ? <LoadingState label="Loading receipt" /> : null}
				{detail ? (
					<ReceiptDetailView receipt={detail} />
				) : loading ? null : (
					<EmptyState
						detail="Select a receipt to inspect its redacted timeline and proof lineage."
						title="Select an execution"
					/>
				)}
			</main>
		</div>
	);
}
