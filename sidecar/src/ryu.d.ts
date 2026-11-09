import type { SafeActionsRequestValue } from "./wire.ts";
export interface SafeActionsRequest {
	body?: SafeActionsRequestValue;
	method?: "GET" | "POST" | "PUT" | "DELETE";
	path: string;
}

export interface RyuSafeActions {
	request(input: SafeActionsRequest): Promise<SafeActionsRequestValue>;
}

export interface CompanionThemeSubscription {
	dispose(): void;
}

export interface CompanionThemeBridge {
	shell?: {
		subscribeTheme?: (options: {
			onChange: (tokens: Record<string, string>) => void;
		}) => CompanionThemeSubscription;
	};
}

export type CompanionMessageValues = Record<
	string,
	string | number | boolean | null
>;

export interface CompanionI18nSnapshot {
	direction: "ltr" | "rtl";
	locale: string;
	packId: string | null;
	packName: string | null;
	packVersion: string | null;
}

/** The host's Companion language bridge (`window.ryu.i18n`). */
export interface CompanionI18nBridge {
	get(): Promise<CompanionI18nSnapshot>;
	subscribe(options: { onChange: (snapshot: CompanionI18nSnapshot) => void }): {
		dispose(): void;
	};
	translate(input: {
		defaultMessage: string;
		id: string;
		values?: CompanionMessageValues;
	}): Promise<string>;
}

declare global {
	interface Window {
		ryu?: {
			i18n?: CompanionI18nBridge;
			safeActions?: RyuSafeActions;
			shell?: CompanionThemeBridge["shell"];
			context?: {
				surface?: "policies" | "reviews" | "receipts";
				policyId?: string;
				reviewId?: string;
				receiptId?: string;
			} | null;
		};
	}
}
