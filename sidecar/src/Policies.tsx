import { useCallback, useEffect, useRef, useState } from "react";
import {
	attestContract,
	createPolicy,
	deletePolicy,
	getCatalog,
	listPolicies,
	listVerifiedAgents,
	updatePolicy,
} from "./api.ts";
import { policySummary } from "./model.ts";
import {
	ContractAttestation,
	type ContractAttestationInput,
} from "./PolicyContract.tsx";
import { PolicyEditor } from "./PolicyEditor.tsx";
import { tl } from "./ryu-i18n.ts";
import {
	EmptyState,
	ErrorBanner,
	LoadingState,
	SuccessBanner,
} from "./SurfaceStates.tsx";
import styles from "./safe-actions.module.css";
import type { Catalog, Policy, VerifiedAgent } from "./types.ts";

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

function errorText(error: Parameters<typeof String>[0]): string {
	return error instanceof Error ? error.message : String(error);
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
			setSuccess(
				tl("“{name}” is now active for bound verified agents.", {
					name: saved.name,
				})
			);
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
				tl("“{name}” was deleted. Bound agents now fail closed.", {
					name: selected.name,
				})
			);
			setSelectedId(undefined);
			await load();
		} catch (cause) {
			setError(errorText(cause));
		} finally {
			setBusy(false);
		}
	};

	const saveContract = async (input: ContractAttestationInput) => {
		setContractBusy(true);
		try {
			await attestContract(input);
			await load();
			setSuccess(
				tl("Operator contract saved for {tool}.", { tool: input.tool })
			);
			setError(undefined);
		} catch (cause) {
			setError(errorText(cause));
		} finally {
			setContractBusy(false);
		}
	};

	return (
		<div className={styles["sa-surface-grid"]}>
			<aside aria-label="Policies" className={styles["sa-rail"]}>
				<div className={styles["sa-rail-head"]}>
					<div>
						<h1>Policies</h1>
					</div>
					<button
						className={`${styles["sa-button"]} ${styles.primary} ${styles.compact}`}
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
				<div className={styles["sa-catalog-note"]}>
					<span>Bound catalog</span>
					<strong>
						{tl("{count, plural, one {# tool} other {# tools}}", {
							count: catalog?.tools.length ?? 0,
						})}
					</strong>
					<code className={styles["sa-full-hash"]}>
						{catalog?.hash ?? tl("Unavailable")}
					</code>
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
				<ul className={styles["sa-list"]}>
					{policies.map((policy) => (
						<li key={policy.id}>
							<button
								aria-current={policy.id === selectedId ? "page" : undefined}
								className={`${styles["sa-list-row"]} ${
									policy.id === selectedId && !drafting ? styles.selected : ""
								}`}
								onClick={() => {
									setSelectedId(policy.id);
									setDrafting(false);
									setSuccess(undefined);
									requestAnimationFrame(() => workspaceRef.current?.focus());
								}}
								type="button"
							>
								<span className={styles["sa-list-title"]}>{policy.name}</span>
								<span className={styles["sa-list-meta"]}>
									<span>
										{tl(
											"{count, plural, one {# tool rule} other {# tool rules}}",
											{ count: policy.tool_patterns.length }
										)}
									</span>
									<span>v{policy.version ?? 1}</span>
								</span>
								<span className={styles["sa-list-summary"]}>
									{policySummary(policy)}
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
