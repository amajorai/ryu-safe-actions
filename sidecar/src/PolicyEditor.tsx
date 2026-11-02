import { useEffect, useMemo, useRef, useState } from "react";
import { formatTime, policySummary, validatePolicy } from "./model.ts";
import { EffectChecks, splitLines } from "./PolicyContract.tsx";
import styles from "./safe-actions.module.css";
import type { Policy, VerifiedAgent } from "./types.ts";

export function PolicyEditor({
	agents,
	busy,
	onCancel,
	onDelete,
	onSave,
	policy,
}: {
	agents: VerifiedAgent[];
	busy: boolean;
	onCancel: () => void;
	onDelete?: () => void;
	onSave: (policy: Policy) => void;
	policy: Policy;
}) {
	const [draft, setDraft] = useState(policy);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const deleteTriggerRef = useRef<HTMLButtonElement>(null);
	const deleteConfirmRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		setDraft(policy);
		setConfirmDelete(false);
	}, [policy]);
	useEffect(() => {
		if (confirmDelete) {
			deleteConfirmRef.current?.focus();
		}
	}, [confirmDelete]);
	const validation = useMemo(() => validatePolicy(draft), [draft]);
	const set = <K extends keyof Policy>(key: K, value: Policy[K]) =>
		setDraft((current) => ({ ...current, [key]: value }));

	return (
		<form
			className={styles["sa-policy-form"]}
			onSubmit={(event) => {
				event.preventDefault();
				if (validation.valid) {
					onSave(draft);
				}
			}}
		>
			<div className={styles["sa-editor-head"]}>
				<div>
					<h2>
						{draft.version ? draft.name || "Untitled policy" : "New policy"}
					</h2>
				</div>
				<span
					className={`${styles["sa-consistency"]} ${validation.valid ? "" : styles.invalid}`}
					role="status"
				>
					{policySummary(draft)}
				</span>
			</div>

			{validation.errors.length > 0 ? (
				<div
					className={`${styles["sa-inline-findings"]} ${styles.error}`}
					role="alert"
				>
					<strong>Fix before saving</strong>
					<ul>
						{validation.errors.map((error) => (
							<li key={error}>{error}</li>
						))}
					</ul>
				</div>
			) : null}
			{validation.warnings.length > 0 ? (
				<div className={styles["sa-inline-findings"]} role="status">
					<strong>Effective behavior</strong>
					<ul>
						{validation.warnings.map((warning) => (
							<li key={warning}>{warning}</li>
						))}
					</ul>
				</div>
			) : null}

			<fieldset className={styles["sa-fieldset"]}>
				<legend>Verified agents using this policy</legend>
				{agents.length > 0 ? (
					<div className={styles["sa-check-grid"]}>
						{agents.map((agent) => (
							<label className={styles["sa-check"]} key={agent.id}>
								<input
									checked={(draft.bound_agent_ids ?? []).includes(agent.id)}
									onChange={(event) => {
										const current = draft.bound_agent_ids ?? [];
										set(
											"bound_agent_ids",
											event.target.checked
												? [...current, agent.id]
												: current.filter((id) => id !== agent.id)
										);
									}}
									type="checkbox"
								/>
								<span>
									{agent.name}
									{agent.title ? ` — ${agent.title}` : ""}
								</span>
							</label>
						))}
					</div>
				) : (
					<p className={styles["sa-muted"]}>
						No agents currently use the Verified Plan Only safety profile.
					</p>
				)}
			</fieldset>

			<div className={`${styles["sa-form-grid"]} ${styles.two}`}>
				<label className={styles["sa-field"]}>
					<span>Name</span>
					<input
						autoComplete="off"
						name="policy-name"
						onChange={(event) => set("name", event.target.value)}
						placeholder="e.g. Production release operations…"
						required
						value={draft.name}
					/>
				</label>
				<label className={styles["sa-field"]}>
					<span>Description</span>
					<input
						autoComplete="off"
						name="policy-description"
						onChange={(event) => set("description", event.target.value)}
						placeholder="e.g. Who and what this policy protects…"
						value={draft.description ?? ""}
					/>
				</label>
			</div>

			<section className={styles["sa-form-section"]}>
				<div className={styles["sa-section-title"]}>
					<div>
						<span className={styles["sa-step-number"]}>01</span>
						<h3>Allow surface</h3>
					</div>
					<p>Everything not named here remains denied.</p>
				</div>
				<div className={`${styles["sa-form-grid"]} ${styles.two}`}>
					<label className={styles["sa-field"]}>
						<span>Allowed tools</span>
						<textarea
							autoComplete="off"
							name="allowed-tools"
							onChange={(event) =>
								set("tool_patterns", splitLines(event.target.value))
							}
							placeholder={"github.get_*\ngithub.create_release"}
							rows={5}
							spellCheck={false}
							value={draft.tool_patterns.join("\n")}
						/>
						<small>
							Exact names or one trailing <code>.*</code>; one per line.
						</small>
					</label>
					<label className={styles["sa-field"]}>
						<span>Allowed resource prefixes</span>
						<textarea
							autoComplete="off"
							name="allowed-resources"
							onChange={(event) =>
								set("resource_prefixes", splitLines(event.target.value))
							}
							placeholder={"repo:amajorai/ryu\nchannel:#releases"}
							rows={5}
							spellCheck={false}
							value={draft.resource_prefixes.join("\n")}
						/>
						<small>
							A call must stay within every declared resource prefix.
						</small>
					</label>
				</div>
				<EffectChecks
					label="Allowed effects"
					onChange={(effects) => set("allowed_effects", effects)}
					selected={draft.allowed_effects}
				/>
			</section>

			<section className={styles["sa-form-section"]}>
				<div className={styles["sa-section-title"]}>
					<div>
						<span className={styles["sa-step-number"]}>02</span>
						<h3>Human review boundary</h3>
					</div>
					<p>Allowed calls matching these rules pause before execution.</p>
				</div>
				<label className={styles["sa-field"]}>
					<span>Tools that always require review</span>
					<textarea
						autoComplete="off"
						name="review-tools"
						onChange={(event) =>
							set("review_tools", splitLines(event.target.value))
						}
						placeholder="github.create_release"
						rows={3}
						spellCheck={false}
						value={draft.review_tools.join("\n")}
					/>
				</label>
				<EffectChecks
					label="Effects that require review"
					onChange={(effects) => set("review_effects", effects)}
					selected={draft.review_effects}
				/>
			</section>

			<section className={styles["sa-form-section"]}>
				<div className={styles["sa-section-title"]}>
					<div>
						<span className={styles["sa-step-number"]}>03</span>
						<h3>Structural limits</h3>
					</div>
					<p>Bound verifier work and reject oversized plans before review.</p>
				</div>
				<div className={`${styles["sa-form-grid"]} ${styles.three}`}>
					{(
						[
							["max_nodes", "Maximum nodes"],
							["max_depth", "Maximum depth"],
							["max_bytes", "Maximum bytes"],
						] as const
					).map(([key, label]) => (
						<label className={styles["sa-field"]} key={key}>
							<span>{label}</span>
							<input
								autoComplete="off"
								max={
									key === "max_nodes"
										? 4096
										: key === "max_depth"
											? 64
											: 1_048_576
								}
								min={1}
								name={`policy-${key}`}
								onChange={(event) =>
									set("limits", {
										...draft.limits,
										[key]: Number(event.target.value),
									})
								}
								step={1}
								type="number"
								value={draft.limits[key]}
							/>
						</label>
					))}
				</div>
				<label className={styles["sa-switch-row"]}>
					<input
						checked={draft.allow_parallel_reads}
						onChange={(event) =>
							set("allow_parallel_reads", event.target.checked)
						}
						type="checkbox"
					/>
					<span>
						<strong>Allow parallel read-only branches</strong>
						<small>Branches with writes remain rejected by the verifier.</small>
					</span>
				</label>
			</section>

			{draft.hash ? (
				<dl className={styles["sa-hash-strip"]}>
					<div>
						<dt>Policy hash</dt>
						<dd>
							<code className={styles["sa-full-hash"]}>{draft.hash}</code>
						</dd>
					</div>
					<div>
						<dt>Version</dt>
						<dd>{draft.version ?? "—"}</dd>
					</div>
					<div>
						<dt>Updated</dt>
						<dd>{formatTime(draft.updated_at)}</dd>
					</div>
				</dl>
			) : null}

			<div className={styles["sa-form-actions"]}>
				{onDelete ? (
					confirmDelete ? (
						<span
							aria-label="Delete policy confirmation"
							className={styles["sa-delete-confirm"]}
							role="status"
						>
							<span>Delete this policy?</span>
							<button
								className={`${styles["sa-button"]} ${styles.danger}`}
								disabled={busy}
								onClick={onDelete}
								ref={deleteConfirmRef}
								type="button"
							>
								Delete permanently
							</button>
							<button
								className={`${styles["sa-button"]} ${styles.quiet}`}
								onClick={() => {
									setConfirmDelete(false);
									requestAnimationFrame(() =>
										deleteTriggerRef.current?.focus()
									);
								}}
								type="button"
							>
								Keep policy
							</button>
						</span>
					) : (
						<button
							className={`${styles["sa-button"]} ${styles.danger} ${styles.quiet}`}
							onClick={() => setConfirmDelete(true)}
							ref={deleteTriggerRef}
							type="button"
						>
							Delete
						</button>
					)
				) : (
					<span />
				)}
				<div>
					<button
						className={`${styles["sa-button"]} ${styles.quiet}`}
						onClick={onCancel}
						type="button"
					>
						Cancel
					</button>
					<button
						className={`${styles["sa-button"]} ${styles.primary}`}
						disabled={busy || !validation.valid}
						type="submit"
					>
						{busy ? "Saving…" : "Save policy"}
					</button>
				</div>
			</div>
		</form>
	);
}
