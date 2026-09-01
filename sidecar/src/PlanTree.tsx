import { safeJson, shortHash } from "./model.ts";
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
				<span className="sa-tree-kicker">{kindLabel(node)}</span>
				<strong>{node.title ?? node.tool}</strong>
				<code className="sa-tool-name">{node.tool}</code>
			</>
		);
	}
	if (node.kind === "if") {
		return (
			<>
				<span className="sa-tree-kicker">Condition</span>
				<strong>
					{node.title ?? node.condition.description ?? "Typed branch"}
				</strong>
				<code className="sa-tool-name">
					{node.condition.description ??
						`${node.condition.source ?? "value"} ${node.condition.operator ?? "eq"} ${String(node.condition.value)}`}
				</code>
			</>
		);
	}
	return (
		<>
			<span className="sa-tree-kicker">{node.kind}</span>
			<strong>{node.title ?? `${node.kind} block`}</strong>
			<span className="sa-tree-count">
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
		<li className={`sa-tree-node sa-tree-${node.kind}`}>
			<div className="sa-tree-line">
				{branch ? <span className="sa-branch-label">{branch}</span> : null}
				<NodeSummary node={node} />
				{nodeFindings.map((finding) => (
					<span
						className={`sa-finding-dot ${finding.severity}`}
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
						<span className="sa-sr-only">
							{finding.severity} finding: {finding.message}
						</span>
					</span>
				))}
			</div>
			{node.kind === "call" ? (
				<div className="sa-call-detail">
					<div aria-label="Effects" className="sa-token-row">
						{node.effects.map((effect) => (
							<span className={`sa-token effect-${effect}`} key={effect}>
								{effect}
							</span>
						))}
					</div>
					{node.resources.length > 0 ? (
						<span className="sa-resource-line">
							{node.resources.map((resource, index) => (
								<bdi key={resource}>
									{index > 0 ? ` · ${resource}` : resource}
								</bdi>
							))}
						</span>
					) : null}
					<span
						aria-label={`Argument hash ${node.arguments_hash ?? node.argument_hash ?? "missing"}`}
						className="sa-hash-inline"
					>
						args {shortHash(node.arguments_hash ?? node.argument_hash)}
					</span>
					<details className="sa-argument-evidence">
						<summary>Core-redacted argument structure</summary>
						<p>
							Literal values are removed by Core before this Companion receives
							the plan.
						</p>
						<p>
							Hash of original arguments:{" "}
							<code className="sa-full-hash">
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
				<ul className="sa-tree-children">
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
		<div className="sa-plan-tree">
			<ul className="sa-tree-root">
				<PlanBranch findings={findings} node={plan} />
			</ul>
		</div>
	);
}
