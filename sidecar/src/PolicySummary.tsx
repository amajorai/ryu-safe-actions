import type { PolicySummaryState } from "./model.ts";
import { tl, useI18nRevision } from "./ryu-i18n.ts";

/**
 * Words a policy's consistency verdict in the host language. Each kind is
 * one whole ICU message whose count stays a `plural` argument, so a language
 * with more plural categories than English (Arabic, Polish, …) picks its own
 * form instead of an English `n === 1` split.
 */
export function policySummaryText(summary: PolicySummaryState): string {
	switch (summary.kind) {
		case "invalid":
			return tl(
				"{count, plural, one {# blocking error} other {# blocking errors}}",
				{ count: summary.errorCount }
			);
		case "deny-all":
			return tl("Consistent · denies all calls");
		default:
			return tl(
				"{count, plural, =0 {Consistent · default deny · no review rules} one {Consistent · default deny · # review rule} other {Consistent · default deny · # review rules}}",
				{ count: summary.reviewRuleCount }
			);
	}
}

export function PolicySummary({ summary }: { summary: PolicySummaryState }) {
	useI18nRevision();
	return <>{policySummaryText(summary)}</>;
}
