import { safeJson, shortHash } from "./model.ts";
import styles from "./safe-actions.module.css";
import type { Finding, PlanNode } from "./types.ts";

function kindLabel(node: PlanNode): string {
	switch (node.kind) {
		case "call":
			return "Tool call";
		case "if":
			return "Condition";
		default:
			return node.kind;
	}
}

function NodeSummary({ node }: { node: PlanNode }) {
	if (node.kind === "call") {
		return (
			<>
				<span className={styles["sa-tree-label"]}>{kindLabel(node)}</span>
				<strong>{node.title ?? node.tool}</strong>
				<code className={styles["sa-tool-name"]}>{node.tool}</code>
			</>
		);
	}
	if (node.kind === "if") {
		return (
			<>
				<span className={styles["sa-tree-label"]}>Condition</span>
				<strong>
					{node.title ?? node.condition.description ?? "Typed branch"}
				</strong>
				<code className={styles["sa-tool-name"]}>
					{node.condition.description ??
						`${node.condition.source ?? "value"} ${node.condition.operator ?? "eq"} ${String(node.condition.value)}`}
				</code>
			</>
		);
	}
	return (
		<>
			<span className={styles["sa-tree-label"]}>{node.kind}</span>
			<strong>{node.title ?? `${node.kind} block`}</strong>
			<span className={styles["sa-tree-count"]}>
				{node.children.length} {node.children.length === 1 ? "node" : "nodes"}
			</span>
		</>
	);
}

function PlanBranch({
	branch,
	findings,
	node,
}: {
	branch?: string;
	findings: Finding[];
	node: PlanNode;
}) {
	const nodeFindings = findings.filter(
		(finding) => finding.node_id === node.id
	);
	const children: Array<{ child: PlanNode; branch?: string }> =
		node.kind === "sequence" || node.kind === "parallel"
			? node.children.map((child) => ({ child }))
			: node.kind === "if"
				? [
						{ child: node.then, branch: "then" },
						...(node.else ? [{ child: node.else, branch: "else" }] : []),
					]
				: [];
	return (
		<li
			className={`${styles["sa-tree-node"]} ${styles[`sa-tree-${node.kind}`]}`}
		>
			<div className={styles["sa-tree-line"]}>
				{branch ? (
					<span className={styles["sa-branch-label"]}>{branch}</span>
				) : null}
				<NodeSummary node={node} />
				{nodeFindings.map((finding) => (
					<span
						className={`${styles["sa-finding-dot"]} ${styles[finding.severity]}`}
						key={finding.id ?? finding.code}
						title={finding.message}
					>
						<span aria-hidden="true">
							{finding.severity === "deny"
								? "!"
								: finding.severity === "review"
									? "?"
									: "i"}
						</span>
						<span className={styles["sa-sr-only"]}>
							{finding.severity} finding: {finding.message}
						</span>
					</span>
				))}
			</div>
			{node.kind === "call" ? (
				<div className={styles["sa-call-detail"]}>
					<div aria-label="Effects" className={styles["sa-token-row"]}>
						{node.effects.map((effect) => (
							<span
								className={`${styles["sa-token"]} ${styles[`effect-${effect}`]}`}
								key={effect}
							>
								{effect}
							</span>
						))}
					</div>
					{node.resources.length > 0 ? (
						<span className={styles["sa-resource-line"]}>
							{node.resources.map((resource, index) => (
								<bdi key={resource}>
									{index > 0 ? ` · ${resource}` : resource}
								</bdi>
							))}
						</span>
					) : null}
					<span
						aria-label={`Argument hash ${node.arguments_hash ?? node.argument_hash ?? "missing"}`}
						className={styles["sa-hash-inline"]}
					>
						args {shortHash(node.arguments_hash ?? node.argument_hash)}
					</span>
					<details className={styles["sa-argument-evidence"]}>
						<summary>Core-redacted argument structure</summary>
						<p>
							Literal values are removed by Core before this Companion receives
							the plan.
						</p>
						<p>
							Hash of original arguments:{" "}
							<code className={styles["sa-full-hash"]}>
								{node.arguments_hash ?? node.argument_hash ?? "Unavailable"}
							</code>
						</p>
						<pre>
							{safeJson(
								node.arguments ?? { marker: "[missing argument evidence]" }
							)}
						</pre>
					</details>
				</div>
			) : null}
			{children.length > 0 ? (
				<ul className={styles["sa-tree-children"]}>
					{children.map(({ child, branch: childBranch }) => (
						<PlanBranch
							branch={childBranch}
							findings={findings}
							key={child.id}
							node={child}
						/>
					))}
				</ul>
			) : null}
		</li>
	);
}

export function PlanTree({
	findings,
	plan,
}: {
	findings: Finding[];
	plan: PlanNode;
}) {
	return (
		<div className={styles["sa-plan-tree"]}>
			<ul className={styles["sa-tree-root"]}>
				<PlanBranch findings={findings} node={plan} />
			</ul>
		</div>
	);
}
