import type { CompanionMessageValues } from "./ryu.d.ts";

/**
 * The English fallback formatter for Companion `tl()` sources. The host
 * formats translated ICU messages itself; outside a host frame (or while a
 * translation is in flight) the English source is formatted here. It covers
 * the subset Safe Actions authors: `{name}` arguments, and `plural` / `select`
 * arguments whose branches may nest further arguments and use `#`.
 */

type MessageValue = CompanionMessageValues[string];

interface Branch {
	body: string;
	key: string;
}

const ARGUMENT_NAME = /^[A-Za-z_]\w*$/u;

/** Index of the `}` that closes the `{` at `open`, or -1. */
function closingBrace(source: string, open: number): number {
	let depth = 0;
	for (let index = open; index < source.length; index += 1) {
		const character = source[index];
		if (character === "{") {
			depth += 1;
		} else if (character === "}") {
			depth -= 1;
			if (depth === 0) {
				return index;
			}
		}
	}
	return -1;
}

/** Parse `key {body} key {body}` branch lists; null when malformed. */
function parseBranches(source: string): Branch[] | null {
	const branches: Branch[] = [];
	let index = 0;
	while (index < source.length) {
		const open = source.indexOf("{", index);
		if (open === -1) {
			return source.slice(index).trim() ? null : branches;
		}
		const key = source.slice(index, open).trim();
		const close = closingBrace(source, open);
		if (!key || close === -1) {
			return null;
		}
		branches.push({ key, body: source.slice(open + 1, close) });
		index = close + 1;
	}
	return branches;
}

function pluralBranch(branches: Branch[], value: MessageValue): Branch | null {
	const count = Number(value);
	return (
		branches.find((branch) => branch.key === `=${count}`) ??
		branches.find((branch) => branch.key === (count === 1 ? "one" : "other")) ??
		branches.find((branch) => branch.key === "other") ??
		null
	);
}

function selectBranch(branches: Branch[], value: MessageValue): Branch | null {
	const key = String(value);
	return (
		branches.find((branch) => branch.key === key) ??
		branches.find((branch) => branch.key === "other") ??
		null
	);
}

/** Format one `{…}` argument; null keeps the original text. */
function formatArgument(
	inner: string,
	values: CompanionMessageValues,
	pound: string | undefined
): string | null {
	const [rawName = "", rawType, ...rest] = inner.split(",");
	const name = rawName.trim();
	if (!ARGUMENT_NAME.test(name)) {
		return null;
	}
	const value = values[name];
	if (value === undefined || value === null) {
		return null;
	}
	const type = rawType?.trim();
	if (type === undefined) {
		return String(value);
	}
	const branches = parseBranches(rest.join(","));
	if (!branches) {
		return null;
	}
	if (type === "plural") {
		const branch = pluralBranch(branches, value);
		return branch ? formatMessage(branch.body, values, String(value)) : null;
	}
	if (type === "select") {
		const branch = selectBranch(branches, value);
		return branch ? formatMessage(branch.body, values, pound) : null;
	}
	return null;
}

/** Format an English ICU source with `values`; `pound` fills a plural `#`. */
export function formatMessage(
	source: string,
	values: CompanionMessageValues = {},
	pound?: string
): string {
	let output = "";
	let index = 0;
	while (index < source.length) {
		const character = source[index] ?? "";
		if (character === "#" && pound !== undefined) {
			output += pound;
			index += 1;
			continue;
		}
		const close = character === "{" ? closingBrace(source, index) : -1;
		if (close === -1) {
			output += character;
			index += 1;
			continue;
		}
		const inner = source.slice(index + 1, close);
		output += formatArgument(inner, values, pound) ?? `{${inner}}`;
		index = close + 1;
	}
	return output;
}
