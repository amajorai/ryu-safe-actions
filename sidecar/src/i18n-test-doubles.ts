import type {
	CompanionI18nBridge,
	CompanionI18nSnapshot,
	CompanionMessageValues,
} from "./ryu.d.ts";
import { formatEnglish } from "./ryu-i18n.ts";

// test-exempt: a test-only host double shared by the i18n tests that import it.

/**
 * A minimal host i18n bridge for tests: it answers `translate` from a fixed
 * catalog keyed by the English source message, formatting the translated
 * message (or the English source when the catalog has none) like the host.
 */
export function catalogHost(
	locale: string,
	catalog: Record<string, string>
): CompanionI18nBridge & { requests: string[] } {
	const snapshot: CompanionI18nSnapshot = {
		direction: "ltr",
		locale,
		packId: null,
		packName: null,
		packVersion: null,
	};
	const requests: string[] = [];
	return {
		requests,
		get: async () => snapshot,
		subscribe: ({ onChange }) => {
			onChange(snapshot);
			return { dispose: () => undefined };
		},
		translate: async ({ defaultMessage, values }) => {
			requests.push(defaultMessage);
			return formatEnglish(
				catalog[defaultMessage] ?? defaultMessage,
				values as CompanionMessageValues
			);
		},
	};
}

/** Let pending host answers settle. */
export async function flushHost(): Promise<void> {
	for (let tick = 0; tick < 5; tick += 1) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}
