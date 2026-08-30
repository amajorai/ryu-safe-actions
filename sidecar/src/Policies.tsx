import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	attestContract,
	createPolicy,
	deletePolicy,
	getCatalog,
	listPolicies,
	listVerifiedAgents,
	updatePolicy,
} from "./api.ts";
import {
	ALL_EFFECTS,
	formatTime,
	policySummary,
	validatePolicy,
} from "./model.ts";
import {
	EmptyState,
	ErrorBanner,
	LoadingState,
	SuccessBanner,
} from "./SurfaceStates.tsx";
import type { Catalog, Effect, Policy, VerifiedAgent } from "./types.ts";

const EMPTY_POLICY: Policy = {
	id: "",
	name: "",
	description: "",
	tool_patterns: [],
	allowed_effects: [],
	review_effects: [],
	review_tools: [],
	resource_prefixes: [],
	limits: { max_nodes: 32, max_depth: 8, max_bytes: 65_536 },
	allow_parallel_reads: false,
};

function errorText(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function splitLines(value: string): string[] {
	return value
		.split(/[\n,]/)
		.map((item) => item.trim())
		.filter(Boolean);
}

function parseResourceBindings(
	value: string
): Array<{ pointer: string; prefix: string }> {
	return value.split("\n").flatMap((line) => {
		const [pointer, prefix, ...extra] = line
			.split("=>")
			.map((part) => part.trim());
		return pointer && prefix && extra.length === 0 ? [{ pointer, prefix }] : [];
	});
}

function EffectChecks({
	descriptionId,
	label,
	onChange,
	selected,
}: {
	descriptionId?: string;
	label: string;
	onChange: (effects: Effect[]) => void;
	selected: Effect[];
}) {
	return (
		<fieldset aria-describedby={descriptionId} className="sa-fieldset">
			<legend>{label}</legend>
			<div className="sa-check-grid">
				{ALL_EFFECTS.map((effect) => (
					<label className="sa-check" key={effect}>
						<input
							checked={selected.includes(effect)}
							onChange={(event) =>
								onChange(
									event.target.checked
										? [...selected, effect]
										: selected.filter((item) => item !== effect)
								)
							}
							type="checkbox"
						/>
						<span>{effect}</span>
					</label>
				))}
			</div>
		</fieldset>
	);
}

function ContractAttestation({
	busy,
	catalog,
	onSave,
}: {
	busy: boolean;
	catalog: Catalog;
	onSave: (input: {
		arguments_independent: boolean;
		effects: Effect[];
		expected_contract_hash?: string;
		expected_implementation_hash?: string;
		resource_bindings: Array<{ pointer: string; prefix: string }>;
		resources: string[];
		tool: string;
	}) => void;
}) {
	const [toolName, setToolName] = useState(catalog.tools[0]?.name ?? "");
	const selected = catalog.tools.find((tool) => tool.name === toolName);
	const [effects, setEffects] = useState<Effect[]>(selected?.effects ?? []);
	const [resources, setResources] = useState<string[]>(
		selected?.resources ?? []
	);
	const [argumentsIndependent, setArgumentsIndependent] = useState(
		selected?.arguments_independent ?? false
	);
	const [bindingsText, setBindingsText] = useState(
		(selected?.resource_bindings ?? [])
			.map((binding) => `${binding.pointer} => ${binding.prefix}`)
			.join("\n")
	);
	useEffect(() => {
		const next =
			catalog.tools.find((tool) => tool.name === toolName) ?? catalog.tools[0];
		if (next && next.name !== toolName) {
			setToolName(next.name);
		}
		setEffects(next?.effects ?? []);
		setResources(next?.resources ?? []);
		setArgumentsIndependent(next?.arguments_independent ?? false);
		setBindingsText(
			(next?.resource_bindings ?? [])
				.map((binding) => `${binding.pointer} => ${binding.prefix}`)
				.join("\n")
		);
	}, [catalog, toolName]);
	const resourceBindings = parseResourceBindings(bindingsText);
	const invalidBindingLine = bindingsText.trim()
		? resourceBindings.length !== bindingsText.trim().split("\n").length
		: false;
	const valid = Boolean(
		toolName &&
			effects.length &&
			!invalidBindingLine &&
			(argumentsIndependent ? resources.length : resourceBindings.length)
	);

	return (
		<form
			className="sa-policy-form sa-contract-panel"
			onSubmit={(event) => {
				event.preventDefault();
				if (valid) {
					onSave({
						tool: toolName,
						effects,
						expected_contract_hash: selected?.contract_hash,
						expected_implementation_hash:
							selected?.contract_implementation_hash,
						resources,
						resource_bindings: argumentsIndependent ? [] : resourceBindings,
						arguments_independent: argumentsIndependent,
					});
				}
			}}
		>
			<div className="sa-editor-head">
				<div>
					<span className="sa-eyebrow">Operator trust boundary</span>
					<h2>Tool contract attestation</h2>
				</div>
				<span
					className={`sa-consistency ${selected?.trust && !selected.contract_stale ? "valid" : "invalid"}`}
				>
					{selected?.contract_stale
						? "Implementation changed — re-attest"
						: selected?.trust
							? selected.trust.replaceAll("_", " ")
							: "Contract missing"}
				</span>
			</div>
			<p className="sa-muted">
				Core stamps your authenticated operator identity. Attest only facts you
				independently verified for this exact tool implementation.
			</p>
			<p className="sa-form-requirement" id="contract-requirements">
				Required: one or more effects, plus either argument-derived resource
				bindings or an explicit argument-independent declaration.
			</p>
			<div className="sa-form-grid">
				<label className="sa-field">
					<span>Catalog tool</span>
					<select
						name="contract-tool"
						onChange={(event) => setToolName(event.target.value)}
						value={toolName}
					>
						{catalog.tools.map((tool) => (
							<option key={tool.name} value={tool.name}>
								{tool.name}
							</option>
						))}
					</select>
				</label>
			</div>
			<EffectChecks
				descriptionId="contract-requirements"
				label="Verified effects (required)"
				onChange={setEffects}
				selected={effects}
			/>
			<label className="sa-check sa-contract-mode">
				<input
					checked={argumentsIndependent}
					onChange={(event) => setArgumentsIndependent(event.target.checked)}
					type="checkbox"
				/>
				<span>Resources are argument-independent</span>
			</label>
			<label className="sa-field">
				<span>
					Static affected resources{" "}
					{argumentsIndependent ? "(required)" : "(optional)"}
				</span>
				<textarea
					autoComplete="off"
					name="contract-resources"
					onChange={(event) => setResources(splitLines(event.target.value))}
					placeholder={"repo:amajorai/ryu\nchannel:#releases"}
					rows={3}
					spellCheck={false}
					value={resources.join("\n")}
				/>
			</label>
			{argumentsIndependent ? null : (
				<label className="sa-field">
					<span>Argument resource bindings (required)</span>
					<textarea
						aria-describedby="contract-binding-help"
						autoComplete="off"
						name="contract-resource-bindings"
						onChange={(event) => setBindingsText(event.target.value)}
						placeholder={"/path => filesystem:\n/channel => slack:channel/"}
						rows={3}
						spellCheck={false}
						value={bindingsText}
					/>
					<small id="contract-binding-help">
						One RFC 6901 pointer and resource prefix per line. Prefixes must end
						in “:” or “/”. Dynamic step-output values fail closed.
					</small>
				</label>
			)}
			{valid ? null : (
				<p className="sa-form-validation" role="status">
					Complete every required contract field before saving.
				</p>
			)}
			<div className="sa-form-actions">
				<span />
				<button
					className="sa-button primary"
					disabled={busy || !valid}
					type="submit"
				>
					{busy ? "Attesting…" : "Save operator attestation"}
				</button>
			</div>
		</form>
	);
}

function PolicyEditor({
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
			className="sa-policy-form"
			onSubmit={(event) => {
				event.preventDefault();
				if (validation.valid) {
					onSave(draft);
				}
			}}
		>
			<div className="sa-editor-head">
				<div>
					<span className="sa-eyebrow">Default deny policy</span>
					<h2>
						{draft.version ? draft.name || "Untitled policy" : "New policy"}
					</h2>
				</div>
				<span
					className={`sa-consistency ${validation.valid ? "valid" : "invalid"}`}
					role="status"
				>
					{policySummary(draft)}
				</span>
			</div>

			{validation.errors.length > 0 ? (
				<div className="sa-inline-findings error" role="alert">
					<strong>Fix before saving</strong>
					<ul>
						{validation.errors.map((error) => (
							<li key={error}>{error}</li>
						))}
					</ul>
				</div>
			) : null}
			{validation.warnings.length > 0 ? (
				<div className="sa-inline-findings warning" role="status">
					<strong>Effective behavior</strong>
					<ul>
						{validation.warnings.map((warning) => (
							<li key={warning}>{warning}</li>
						))}
					</ul>
				</div>
			) : null}

			<fieldset className="sa-fieldset">
				<legend>Verified agents using this policy</legend>
				{agents.length > 0 ? (
					<div className="sa-check-grid">
						{agents.map((agent) => (
							<label className="sa-check" key={agent.id}>
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
					<p className="sa-muted">
						No agents currently use the Verified Plan Only safety profile.
					</p>
				)}
			</fieldset>

			<div className="sa-form-grid two">
				<label className="sa-field">
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
				<label className="sa-field">
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

			<section className="sa-form-section">
				<div className="sa-section-title">
					<div>
						<span className="sa-step-number">01</span>
						<h3>Allow surface</h3>
					</div>
					<p>Everything not named here remains denied.</p>
				</div>
				<div className="sa-form-grid two">
					<label className="sa-field">
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
					<label className="sa-field">
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

			<section className="sa-form-section">
				<div className="sa-section-title">
					<div>
						<span className="sa-step-number">02</span>
						<h3>Human review boundary</h3>
					</div>
					<p>Allowed calls matching these rules pause before execution.</p>
				</div>
				<label className="sa-field">
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

			<section className="sa-form-section">
				<div className="sa-section-title">
					<div>
						<span className="sa-step-number">03</span>
						<h3>Structural limits</h3>
					</div>
					<p>Bound verifier work and reject oversized plans before review.</p>
				</div>
				<div className="sa-form-grid three">
					{(
						[
							["max_nodes", "Maximum nodes"],
							["max_depth", "Maximum depth"],
							["max_bytes", "Maximum bytes"],
						] as const
					).map(([key, label]) => (
						<label className="sa-field" key={key}>
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
				<label className="sa-switch-row">
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
				<dl className="sa-hash-strip">
					<div>
						<dt>Policy hash</dt>
						<dd>
							<code className="sa-full-hash">{draft.hash}</code>
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

			<div className="sa-form-actions">
				{onDelete ? (
					confirmDelete ? (
						<span
							aria-label="Delete policy confirmation"
							className="sa-delete-confirm"
							role="status"
						>
							<span>Delete this policy?</span>
							<button
								className="sa-button danger"
								disabled={busy}
								onClick={onDelete}
								ref={deleteConfirmRef}
								type="button"
							>
								Delete permanently
							</button>
							<button
								className="sa-button quiet"
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
							className="sa-button danger quiet"
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
					<button className="sa-button quiet" onClick={onCancel} type="button">
						Cancel
					</button>
					<button
						className="sa-button primary"
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

export function Policies() {
	const [policies, setPolicies] = useState<Policy[]>([]);
	const [catalog, setCatalog] = useState<Catalog>();
	const [agents, setAgents] = useState<VerifiedAgent[]>([]);
	const [selectedId, setSelectedId] = useState<string>();
	const [drafting, setDrafting] = useState(false);
	const [draftId, setDraftId] = useState("");
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [contractBusy, setContractBusy] = useState(false);
	const workspaceRef = useRef<HTMLElement>(null);
	const [error, setError] = useState<string>();
	const [success, setSuccess] = useState<string>();

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const [nextPolicies, nextCatalog, nextAgents] = await Promise.all([
				listPolicies(),
				getCatalog(),
				listVerifiedAgents(),
			]);
			setPolicies(nextPolicies);
			setCatalog(nextCatalog);
			setAgents(nextAgents);
			setSelectedId((current) =>
				current && nextPolicies.some((policy) => policy.id === current)
					? current
					: nextPolicies[0]?.id
			);
			setError(undefined);
		} catch (cause) {
			setPolicies([]);
			setCatalog(undefined);
			setAgents([]);
			setSelectedId(undefined);
			setError(errorText(cause));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const selected = policies.find((policy) => policy.id === selectedId);
	const save = async (policy: Policy) => {
		setBusy(true);
		try {
			const saved = policy.version
				? await updatePolicy(policy)
				: await createPolicy(policy);
			await load();
			setSelectedId(saved.id);
			setDrafting(false);
			setSuccess(`“${saved.name}” is now active for bound verified agents.`);
		} catch (cause) {
			setError(errorText(cause));
		} finally {
			setBusy(false);
		}
	};

	const remove = async () => {
		if (!selected) {
			return;
		}
		setBusy(true);
		try {
			if (selected.version === undefined) {
				throw new Error("Reload this policy before deleting it.");
			}
			await deletePolicy(selected.id, selected.version);
			setSuccess(
				`“${selected.name}” was deleted. Bound agents now fail closed.`
			);
			setSelectedId(undefined);
			await load();
		} catch (cause) {
			setError(errorText(cause));
		} finally {
			setBusy(false);
		}
	};

	const saveContract = async (input: {
		arguments_independent: boolean;
		effects: Effect[];
		expected_contract_hash?: string;
		expected_implementation_hash?: string;
		resource_bindings: Array<{ pointer: string; prefix: string }>;
		resources: string[];
		tool: string;
	}) => {
		setContractBusy(true);
		try {
			await attestContract(input);
			await load();
			setSuccess(`Operator contract saved for ${input.tool}.`);
			setError(undefined);
		} catch (cause) {
			setError(errorText(cause));
		} finally {
			setContractBusy(false);
		}
	};

	return (
		<div className="sa-surface-grid">
			<aside aria-label="Policies" className="sa-rail">
				<div className="sa-rail-head">
					<div>
						<span className="sa-eyebrow">Guardrails</span>
						<h1>Policies</h1>
					</div>
					<button
						className="sa-button primary compact"
						onClick={() => {
							setDraftId(crypto.randomUUID());
							setDrafting(true);
							setSuccess(undefined);
							requestAnimationFrame(() => workspaceRef.current?.focus());
						}}
						type="button"
					>
						New
					</button>
				</div>
				<div className="sa-catalog-note">
					<span>Bound catalog</span>
					<strong>{catalog?.tools.length ?? 0} tools</strong>
					<code className="sa-full-hash">{catalog?.hash ?? "Unavailable"}</code>
				</div>
				{loading && policies.length === 0 ? (
					<LoadingState label="Loading policies" />
				) : null}
				{!loading && policies.length === 0 ? (
					<EmptyState
						detail="Verified agents fail closed until a default-deny policy is created and bound."
						title="No policies"
					/>
				) : null}
				<ul className="sa-list">
					{policies.map((policy) => (
						<li key={policy.id}>
							<button
								aria-current={policy.id === selectedId ? "page" : undefined}
								className={`sa-list-row ${policy.id === selectedId && !drafting ? "selected" : ""}`}
								onClick={() => {
									setSelectedId(policy.id);
									setDrafting(false);
									setSuccess(undefined);
									requestAnimationFrame(() => workspaceRef.current?.focus());
								}}
								type="button"
							>
								<span className="sa-list-title">{policy.name}</span>
								<span className="sa-list-meta">
									<span>{policy.tool_patterns.length} tool rules</span>
									<span>v{policy.version ?? 1}</span>
								</span>
								<span className="sa-list-summary">{policySummary(policy)}</span>
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
				{drafting ? (
					<PolicyEditor
						agents={agents}
						busy={busy}
						onCancel={() => setDrafting(false)}
						onSave={(policy) => void save(policy)}
						policy={{ ...EMPTY_POLICY, id: draftId || crypto.randomUUID() }}
					/>
				) : selected ? (
					<PolicyEditor
						agents={agents}
						busy={busy}
						onCancel={() => setSuccess(undefined)}
						onDelete={() => void remove()}
						onSave={(policy) => void save(policy)}
						policy={selected}
					/>
				) : loading ? null : (
					<EmptyState
						detail="Create a policy to define the exact tools, effects, and resources a verified agent may request."
						title="Start with a boundary"
					/>
				)}
				{catalog && catalog.tools.length > 0 ? (
					<ContractAttestation
						busy={contractBusy}
						catalog={catalog}
						onSave={(input) => void saveContract(input)}
					/>
				) : null}
			</main>
		</div>
	);
}
