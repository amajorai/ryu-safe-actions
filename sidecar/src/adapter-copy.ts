import { tl } from "./ryu-i18n.ts";

/**
 * The Core adapter (`api.ts`) turns Core's typed review and receipt records
 * into finished English: the review heading, the verifier's explanation,
 * why approval is unavailable, plan-node labels and the receipt heading.
 * `localizeAdapterCopy` maps each of those known sentences back to one whole
 * catalog message, so a reviewer sees them in the host's language. Anything
 * else (a presentation title a caller wrote, a hash, a tool name) is
 * returned unchanged.
 *
 * Keep the sentences here in step with the ones `api.ts` builds.
 */

const ARGUMENT_STRUCTURE_SUFFIX =
	" is missing a Core-redacted argument structure, a Core argument hash, or proved invocation resources.";

function exactCopy(text: string): string | null {
	switch (text) {
		case "The deterministic verifier proved the plan is within policy but found rules that require human judgment.":
			return tl(
				"The deterministic verifier proved the plan is within policy but found rules that require human judgment."
			);
		case "One or more proof bindings are missing.":
			return tl("One or more proof bindings are missing.");
		case "The live tool catalog does not match the catalog bound into this review.":
			return tl(
				"The live tool catalog does not match the catalog bound into this review."
			);
		case "Core did not return the verifier report.":
			return tl("Core did not return the verifier report.");
		case "Core did not return the persisted typed plan.":
			return tl("Core did not return the persisted typed plan.");
		case "Plan from verified agent":
			return tl("Plan from a verified agent");
		case "Conditional branch":
			return tl("Conditional branch");
		case "Parallel branch":
			return tl("Parallel branch");
		case "Ordered steps":
			return tl("Ordered steps");
		case "Typed predicate":
			return tl("Typed predicate");
		case "Missing effect contract":
			return tl("Missing effect contract");
		case "Unknown tool":
			return tl("Unknown tool");
		default:
			return null;
	}
}

/**
 * The one identifier between `prefix` and `suffix` (an agent id, a decision
 * code, a tool name, an operator). The adapter only ever inserts such a
 * token, so a caller-written title with spaces is never mistaken for it.
 */
function between(text: string, prefix: string, suffix = ""): string | null {
	if (!(text.startsWith(prefix) && text.endsWith(suffix))) {
		return null;
	}
	const token = text.slice(prefix.length, text.length - suffix.length);
	return token.length > 0 && !/\s/u.test(token) ? token : null;
}

function templateCopy(text: string): string | null {
	const agent = between(text, "Plan from ");
	if (agent !== null) {
		return tl("Plan from {agent}", { agent });
	}
	const decision = between(text, "Verifier decision: ", ".");
	if (decision !== null) {
		return tl("Verifier decision: {decision}.", { decision });
	}
	const tool = between(text, "Tool ", ARGUMENT_STRUCTURE_SUFFIX);
	if (tool !== null) {
		return tl(
			"Tool {tool} is missing a Core-redacted argument structure, a Core argument hash, or proved invocation resources.",
			{ tool }
		);
	}
	const execution = between(text, "Execution ");
	if (execution !== null) {
		return tl("Execution {id}", { id: execution });
	}
	const operator = between(text, "Compare typed values (", ")");
	if (operator !== null) {
		return tl("Compare typed values ({operator})", { operator });
	}
	return codeCopy(text);
}

/**
 * A Core code the adapter spelled out with spaces (`all of predicate`,
 * `core attested effect contract`): the code stays verbatim.
 */
function codeCopy(text: string): string | null {
	const words = /^([a-z][a-z0-9 ]*) (predicate|effect contract)$/u.exec(text);
	if (!words) {
		return null;
	}
	const [, code = "", noun] = words;
	return noun === "predicate"
		? tl("{kind} predicate", { kind: code })
		: tl("{trust} effect contract", { trust: code });
}

/** `text` in the host's language when it is known adapter copy. */
export function localizeAdapterCopy(text: string): string;
export function localizeAdapterCopy(text: undefined): undefined;
export function localizeAdapterCopy(
	text: string | undefined
): string | undefined;
export function localizeAdapterCopy(
	text: string | undefined
): string | undefined {
	if (text === undefined) {
		return undefined;
	}
	return exactCopy(text) ?? templateCopy(text) ?? text;
}
