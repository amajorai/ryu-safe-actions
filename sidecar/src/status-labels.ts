import { tl } from "./ryu-i18n.ts";

/**
 * The status words a review, a receipt, or a receipt step shows in its
 * badge. The badge keeps the raw status as its class name; this is only the
 * visible word, as one whole `select` message so every language translates
 * each status in context instead of matching a bare short word. A status
 * this Companion does not know yet is shown verbatim.
 */
export function statusLabel(status: string): string {
	return tl(
		"{status, select, pending {pending} approved {approved} denied {denied} executing {executing} running {running} queued {queued} closed {closed} expired {expired} succeeded {succeeded} failed {failed} uncertain {uncertain} skipped {skipped} other {{status}}}",
		{ status }
	);
}
