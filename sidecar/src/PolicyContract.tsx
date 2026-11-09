import { useEffect, useState } from "react";
import { ALL_EFFECTS } from "./model.ts";
import { tl } from "./ryu-i18n.ts";
import styles from "./safe-actions.module.css";
import type { Catalog, Effect } from "./types.ts";

export interface ContractAttestationInput {
	arguments_independent: boolean;
	effects: Effect[];
	expected_contract_hash?: string;
	expected_implementation_hash?: string;
	resource_bindings: Array<{ pointer: string; prefix: string }>;
	resources: string[];
	tool: string;
}

export function splitLines(value: string): string[] {
	return value
		.split(/[\n,]/)
		.map((item) => item.trim())
		.filter(Boolean);
}

export function parseResourceBindings(
	value: string
): Array<{ pointer: string; prefix: string }> {
	return value.split("\n").flatMap((line) => {
		const [pointer, prefix, ...extra] = line
			.split("=>")
			.map((part) => part.trim());
		return pointer && prefix && extra.length === 0 ? [{ pointer, prefix }] : [];
	});
}

export function EffectChecks({
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
		<fieldset
			aria-describedby={descriptionId}
			className={styles["sa-fieldset"]}
		>
			<legend>{label}</legend>
			<div className={styles["sa-check-grid"]}>
				{ALL_EFFECTS.map((effect) => (
					<label className={styles["sa-check"]} key={effect}>
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

export function ContractAttestation({
	busy,
	catalog,
	onSave,
}: {
	busy: boolean;
	catalog: Catalog;
	onSave: (input: ContractAttestationInput) => void;
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
			className={`${styles["sa-policy-form"]} ${styles["sa-contract-panel"]}`}
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
			<div className={styles["sa-editor-head"]}>
				<div>
					<h2>Tool contract attestation</h2>
				</div>
				<span
					className={`${styles["sa-consistency"]} ${
						selected?.trust && !selected.contract_stale ? "" : styles.invalid
					}`}
				>
					{selected?.contract_stale
						? "Implementation changed — re-attest"
						: selected?.trust
							? selected.trust.replaceAll("_", " ")
							: "Contract missing"}
				</span>
			</div>
			<p className={styles["sa-muted"]}>
				Core stamps your authenticated operator identity. Attest only facts you
				independently verified for this exact tool implementation.
			</p>
			<p className={styles["sa-form-requirement"]} id="contract-requirements">
				Required: one or more effects, plus either argument-derived resource
				bindings or an explicit argument-independent declaration.
			</p>
			<div className={styles["sa-form-grid"]}>
				<label className={styles["sa-field"]}>
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
			<label className={`${styles["sa-check"]} ${styles["sa-contract-mode"]}`}>
				<input
					checked={argumentsIndependent}
					onChange={(event) => setArgumentsIndependent(event.target.checked)}
					type="checkbox"
				/>
				<span>Resources are argument-independent</span>
			</label>
			<label className={styles["sa-field"]}>
				<span>
					{argumentsIndependent
						? tl("Static affected resources (required)")
						: tl("Static affected resources (optional)")}
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
				<label className={styles["sa-field"]}>
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
				<p className={styles["sa-form-validation"]} role="status">
					Complete every required contract field before saving.
				</p>
			)}
			<div className={styles["sa-form-actions"]}>
				<span />
				<button
					className={`${styles["sa-button"]} ${styles.primary}`}
					disabled={busy || !valid}
					type="submit"
				>
					{busy ? "Attesting…" : "Save operator attestation"}
				</button>
			</div>
		</form>
	);
}
