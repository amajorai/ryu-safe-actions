import {
	i18nSnapshot,
	isEnglishLocale,
	requestTranslation,
	subscribeI18n,
} from "./ryu-i18n.ts";

/**
 * A small host-backed DOM localizer for the standalone Safe Actions
 * Companion. It translates the English UI literals React renders (text and
 * the text-bearing attributes the catalog extractor collects) through the
 * host's official catalog, and restores the English source before asking
 * again when the host language changes. Text the catalog does not know (plan
 * titles, hashes, tool names) comes back verbatim and is left untouched.
 */

const TRANSLATABLE_ATTRIBUTES = [
	"aria-description",
	"aria-label",
	"aria-placeholder",
	"aria-roledescription",
	"alt",
	"placeholder",
	"title",
] as const;

type TranslatableAttribute = (typeof TRANSLATABLE_ATTRIBUTES)[number];

const ATTRIBUTE_SELECTOR = TRANSLATABLE_ATTRIBUTES.map(
	(attribute) => `[${attribute}]`
).join(",");

const SKIPPED =
	'script,style,pre,code,textarea,[contenteditable="true"],[data-ryu-i18n="off"],[translate="no"]';

const MAX_LITERAL_LENGTH = 2000;

interface LocalizedRecord {
	output: string;
	source: string;
}

function hasLetters(value: string): boolean {
	return /[A-Za-zÀ-￿]/u.test(value);
}

function shouldSkip(element: Element | null): boolean {
	return Boolean(element?.closest(SKIPPED));
}

/** Translate `root`'s English literals and keep following it. */
export function observeCompanionLocalization(root: Element): () => void {
	if (!("MutationObserver" in globalThis)) {
		return () => undefined;
	}
	const textRecords = new WeakMap<Text, LocalizedRecord>();
	const attributeRecords = new WeakMap<
		Element,
		Map<TranslatableAttribute, LocalizedRecord>
	>();
	let disposed = false;
	let scanQueued = false;

	const localize = (
		current: string,
		record: LocalizedRecord | undefined,
		apply: (output: string) => void,
		remember: (record: LocalizedRecord) => void
	) => {
		const source =
			record && current === record.output ? record.source : current;
		const trimmed = source.trim();
		if (
			trimmed.length === 0 ||
			trimmed.length > MAX_LITERAL_LENGTH ||
			!hasLetters(trimmed)
		) {
			return;
		}
		if (isEnglishLocale(i18nSnapshot().locale)) {
			if (record && current === record.output && current !== source) {
				apply(source);
			}
			remember({ output: source, source });
			return;
		}
		const collapsed = trimmed.replace(/\s+/gu, " ");
		const translated = requestTranslation(collapsed);
		if (translated === null || translated === collapsed) {
			// Unknown or still in flight: show the English source meanwhile.
			if (current !== source) {
				apply(source);
			}
			remember({ output: source, source });
			return;
		}
		const leading = source.match(/^\s*/u)?.[0] ?? "";
		const trailing = source.match(/\s*$/u)?.[0] ?? "";
		const output = `${leading}${translated}${trailing}`;
		remember({ output, source });
		if (current !== output) {
			apply(output);
		}
	};

	const localizeText = (node: Text) => {
		if (shouldSkip(node.parentElement)) {
			return;
		}
		localize(
			node.data,
			textRecords.get(node),
			(output) => {
				node.data = output;
			},
			(record) => textRecords.set(node, record)
		);
	};

	const localizeAttributes = (element: Element) => {
		if (shouldSkip(element)) {
			return;
		}
		let records = attributeRecords.get(element);
		for (const attribute of TRANSLATABLE_ATTRIBUTES) {
			const current = element.getAttribute(attribute);
			if (current === null) {
				continue;
			}
			if (!records) {
				records = new Map();
				attributeRecords.set(element, records);
			}
			const owned = records;
			localize(
				current,
				owned.get(attribute),
				(output) => element.setAttribute(attribute, output),
				(record) => owned.set(attribute, record)
			);
		}
	};

	const scan = () => {
		scanQueued = false;
		if (disposed) {
			return;
		}
		const walker = root.ownerDocument.createTreeWalker(root, 4);
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			// SAFETY: the walker only visits SHOW_TEXT (4) nodes.
			localizeText(node as Text);
		}
		if (root.matches(ATTRIBUTE_SELECTOR)) {
			localizeAttributes(root);
		}
		for (const element of root.querySelectorAll(ATTRIBUTE_SELECTOR)) {
			localizeAttributes(element);
		}
	};

	const queueScan = () => {
		if (scanQueued || disposed) {
			return;
		}
		scanQueued = true;
		queueMicrotask(scan);
	};

	const observer = new MutationObserver(queueScan);
	observer.observe(root, {
		attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
		attributes: true,
		characterData: true,
		childList: true,
		subtree: true,
	});
	const unsubscribe = subscribeI18n(queueScan);
	queueScan();
	return () => {
		disposed = true;
		observer.disconnect();
		unsubscribe();
	};
}
