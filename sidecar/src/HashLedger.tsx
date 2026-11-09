import { tl } from "./ryu-i18n.ts";
import styles from "./safe-actions.module.css";
import type { ProofHashes } from "./types.ts";

const HASHES: [keyof ProofHashes, string][] = [
	["plan_hash", "Plan"],
	["policy_hash", "Policy"],
	["catalog_hash", "Catalog"],
	["verifier_hash", "Verifier"],
	["certificate_hash", "Certificate"],
];

export function HashLedger({ hashes }: { hashes?: ProofHashes }) {
	return (
		<dl className={styles["sa-proof-ledger"]}>
			{HASHES.map(([key, label]) => (
				<div key={key}>
					<dt>{label}</dt>
					<dd>
						<code className={styles["sa-full-hash"]}>
							{/* The localizer skips code, so the fallback is a literal tl(). */}
							{hashes?.[key] ?? tl("Unavailable")}
						</code>
					</dd>
				</div>
			))}
		</dl>
	);
}
