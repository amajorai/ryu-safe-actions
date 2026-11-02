import { useSyncExternalStore } from "react";
import type {
	CompanionI18nBridge,
	CompanionI18nSnapshot,
	CompanionMessageValues,
} from "./ryu.d.ts";
import { formatMessage } from "./ryu-message-format.ts";

/**
 * Safe Actions is a standalone static satellite, so it cannot import the
 * monorepo's `@ryu/i18n` runtime. The Ryu host owns the official catalog and
 * answers `window.ryu.i18n.translate` for any English source literal; this
 * module mirrors the host's language and direction and caches its answers so
 * `tl()` stays synchronous for React. Outside a host frame (a static preview
 * or the deterministic proof mode) the copy stays English.
 */

const DEFAULT_SNAPSHOT: CompanionI18nSnapshot = {
	direction: "ltr",
	locale: "en",
	packId: null,
	packName: null,
	packVersion: null,
};

let snapshot: CompanionI18nSnapshot = DEFAULT_SNAPSHOT;
let bridge: CompanionI18nBridge | null = null;
let revision = 0;
const listeners = new Set<() => void>();
const translations = new Map<string, string>();
const pending = new Set<string>();

function notify(): void {
	revision += 1;
	for (const listener of listeners) {
		listener();
	}
}

/** Whether `locale` is an English locale, whose copy is the source itself. */
export function isEnglishLocale(locale: string): boolean {
	return /^en(?:-|$)/iu.test(locale);
}

/** English fallback formatting: `{name}` arguments plus ICU `plural` and
 * `select` arguments (see `ryu-message-format.ts`). */
export function formatEnglish(
	source: string,
	values: CompanionMessageValues = {}
): string {
	return formatMessage(source, values);
}

function cacheKey(
	locale: string,
	source: string,
	values: CompanionMessageValues
): string {
	return `${locale}\u0000${source}\u0000${JSON.stringify(values)}`;
}

/** The literal id the host would derive itself; the host also resolves the
 * English fallback, so this only has to be stable. */
function literalId(source: string): string {
	let hash = 2_166_136_261;
	for (const character of source) {
		hash = Math.imul(hash ^ (character.codePointAt(0) ?? 0), 16_777_619);
	}
	const slug =
		source
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/gu, "-")
			.replace(/^-+|-+$/gu, "")
			.slice(0, 48) || "text";
	return `literal.${slug}.${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

/**
 * Ask the host for one literal in the current language. Resolves with the
 * cached answer when it is already known, and with `null` while unknown.
 */
export function requestTranslation(
	source: string,
	values: CompanionMessageValues = {},
	onResolved?: () => void
): string | null {
	const locale = snapshot.locale;
	if (isEnglishLocale(locale)) {
		// The English source is the copy; never ask the host for it, including
		// before the host's first snapshot arrives.
		return null;
	}
	const key = cacheKey(locale, source, values);
	const cached = translations.get(key);
	if (cached !== undefined) {
		return cached;
	}
	const host = bridge;
	if (!host || pending.has(key)) {
		return null;
	}
	pending.add(key);
	const hasValues = Object.keys(values).length > 0;
	host
		.translate({
			defaultMessage: source,
			id: literalId(source),
			...(hasValues ? { values } : {}),
		})
		.then((translated) => {
			pending.delete(key);
			if (typeof translated !== "string" || snapshot.locale !== locale) {
				return;
			}
			translations.set(key, translated);
			onResolved?.();
			notify();
		})
		.catch(() => {
			pending.delete(key);
		});
	return null;
}

/** Translate one English source message into the host's language. */
export function tl(
	source: string,
	values: CompanionMessageValues = {}
): string {
	return requestTranslation(source, values) ?? formatEnglish(source, values);
}

export function i18nSnapshot(): CompanionI18nSnapshot {
	return snapshot;
}

export function i18nRevision(): number {
	return revision;
}

export function subscribeI18n(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** Re-render when the host language changes or a translation arrives. */
export function useI18nRevision(): number {
	return useSyncExternalStore(subscribeI18n, i18nRevision, () => 0);
}

function applySnapshot(next: CompanionI18nSnapshot): void {
	const direction = next.direction === "rtl" ? "rtl" : "ltr";
	const locale = next.locale.trim() || "en";
	if (
		locale !== snapshot.locale ||
		next.packId !== snapshot.packId ||
		next.packVersion !== snapshot.packVersion
	) {
		translations.clear();
		pending.clear();
	}
	snapshot = { ...next, direction, locale };
	if ("document" in globalThis) {
		document.documentElement.lang = locale;
		document.documentElement.dir = direction;
		document.documentElement.style.setProperty("--ryu-locale", locale);
	}
	notify();
}

/**
 * Follow the host's language through its Companion i18n bridge. Returns a
 * disposer; without a bridge the Companion keeps English and LTR.
 */
export function startCompanionI18n(
	host: CompanionI18nBridge | undefined = "window" in globalThis
		? window.ryu?.i18n
		: undefined
): () => void {
	if (!host) {
		return () => undefined;
	}
	bridge = host;
	let disposed = false;
	const onSnapshot = (next: CompanionI18nSnapshot) => {
		if (!disposed) {
			applySnapshot(next);
		}
	};
	host
		.get()
		.then(onSnapshot)
		.catch(() => undefined);
	let subscription: { dispose(): void } | undefined;
	try {
		subscription = host.subscribe({ onChange: onSnapshot });
	} catch {
		// The host may tear the frame down while the first RPC is in flight.
	}
	return () => {
		disposed = true;
		subscription?.dispose();
		if (bridge === host) {
			bridge = null;
		}
	};
}

/** Reset module state between tests. */
export function resetCompanionI18nForTests(): void {
	bridge = null;
	snapshot = DEFAULT_SNAPSHOT;
	translations.clear();
	pending.clear();
	notify();
}
