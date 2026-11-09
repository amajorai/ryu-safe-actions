import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (!GlobalRegistrator.isRegistered) {
	GlobalRegistrator.register();
}

const here = dirname(fileURLToPath(import.meta.url));
const ENTRY = "safe-actions.module.css";
const IMPORT_LINE = /^@import\s+"\.\/([^"]+)";$/gm;

/** The entry module with its `@import` partials inlined in cascade order, as Vite does. */
function partialNames(): string[] {
	const entry = readFileSync(join(here, ENTRY), "utf8");
	return [...entry.matchAll(IMPORT_LINE)].map((match) => match[1] ?? "");
}

function stylesheetText(): string {
	return partialNames()
		.map((name) => readFileSync(join(here, name), "utf8"))
		.join("\n");
}

const PHYSICAL_INLINE_PROPERTY =
	/^\s*(?:left|right|(?:margin|padding|border)-(?:left|right)(?:-[a-z]+)?|text-align:\s*(?:left|right))\s*[:;]/m;

/** A four-value `padding`/`margin`/`inset` whose right and left values differ. */
const ASYMMETRIC_PHYSICAL_SHORTHAND =
	/^[ \t]*(?:padding|margin|inset)[ \t]*:[ \t]*(\S+)[ \t]+(\S+)[ \t]+(\S+)[ \t]+([^\s;]+)[ \t]*;/gm;

function asymmetricShorthands(css: string): string[] {
	return [...css.matchAll(ASYMMETRIC_PHYSICAL_SHORTHAND)]
		.filter((match) => match[2] !== match[4])
		.map((match) => match[0].trim());
}

afterEach(() => {
	document.head.replaceChildren();
	document.body.replaceChildren();
	document.documentElement.removeAttribute("dir");
});

describe("Safe Actions stylesheet in right-to-left locales", () => {
	test("imports every partial and uses no physical inline-axis properties", () => {
		const names = partialNames();
		expect(names).toEqual([
			"safe-actions.layout.module.css",
			"safe-actions.responsive.module.css",
			"safe-actions.markers.module.css",
		]);
		for (const name of names) {
			const css = readFileSync(join(here, name), "utf8");
			expect({ name, match: css.match(PHYSICAL_INLINE_PROPERTY)?.[0] }).toEqual(
				{
					name,
					match: undefined,
				}
			);
			expect({ name, shorthands: asymmetricShorthands(css) }).toEqual({
				name,
				shorthands: [],
			});
		}
	});

	test("tree children and list rows resolve logical sides under dir=rtl", () => {
		document.documentElement.dir = "rtl";
		const style = document.createElement("style");
		style.textContent = stylesheetText();
		document.head.append(style);

		const tree = document.createElement("div");
		tree.className = "sa-tree-children";
		const node = document.createElement("div");
		node.className = "sa-tree-node";
		tree.append(node);
		const row = document.createElement("button");
		row.className = "sa-list-row selected";
		document.body.append(tree, row);

		const treeStyle = getComputedStyle(tree);
		expect(treeStyle.paddingInlineStart).toBe("26px");
		expect(treeStyle.marginInlineStart).toBe("13px");
		expect(treeStyle.borderInlineStart).toContain("1px solid");
		expect(treeStyle.paddingLeft).not.toBe("26px");
		expect(treeStyle.borderLeftWidth).not.toBe("1px");

		const rowStyle = getComputedStyle(row);
		expect(rowStyle.textAlign).toBe("start");
		expect(rowStyle.borderInlineStart).toContain("2px solid");
		expect(rowStyle.borderLeftWidth).not.toBe("2px");
		expect(rowStyle.getPropertyValue("padding-inline")).toBe("14px 10px");
	});
});
