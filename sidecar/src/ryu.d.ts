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

declare global {
	interface Window {
		ryu?: {
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
