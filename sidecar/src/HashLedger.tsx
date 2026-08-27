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
		<dl className="sa-proof-ledger">
			{HASHES.map(([key, label]) => (
				<div key={key}>
					<dt>{label}</dt>
					<dd>
						<code className="sa-full-hash">
							{hashes?.[key] ?? "Unavailable"}
						</code>
					</dd>
				</div>
			))}
		</dl>
	);
}
