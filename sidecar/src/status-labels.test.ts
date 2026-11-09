import { afterEach, describe, expect, test } from "bun:test";
import { catalogHost, flushHost } from "./i18n-test-doubles.ts";
import { resetCompanionI18nForTests, startCompanionI18n } from "./ryu-i18n.ts";
import { statusLabel } from "./status-labels.ts";

const STATUS_MESSAGE =
	"{status, select, pending {pending} approved {approved} denied {denied} executing {executing} running {running} queued {queued} closed {closed} expired {expired} succeeded {succeeded} failed {failed} uncertain {uncertain} skipped {skipped} other {{status}}}";

const STATUSES = [
	"pending",
	"approved",
	"denied",
	"executing",
	"running",
	"queued",
	"closed",
	"expired",
	"succeeded",
	"failed",
	"uncertain",
	"skipped",
];

afterEach(() => {
	resetCompanionI18nForTests();
});

describe("statusLabel", () => {
	test("every review, receipt and step status has its own English word", () => {
		for (const status of STATUSES) {
			expect(statusLabel(status)).toBe(status);
		}
	});

	test("an unknown status falls back verbatim", () => {
		expect(statusLabel("quarantined")).toBe("quarantined");
	});

	test("asks the host for one whole select message and shows its answer", async () => {
		const host = catalogHost("de", {
			[STATUS_MESSAGE]:
				"{status, select, pending {ausstehend} denied {abgelehnt} succeeded {erfolgreich} other {{status}}}",
		});
		startCompanionI18n(host);
		await flushHost();
		for (const status of ["pending", "denied", "succeeded", "quarantined"]) {
			statusLabel(status);
		}
		await flushHost();

		expect(statusLabel("pending")).toBe("ausstehend");
		expect(statusLabel("denied")).toBe("abgelehnt");
		expect(statusLabel("succeeded")).toBe("erfolgreich");
		expect(statusLabel("quarantined")).toBe("quarantined");
		expect(new Set(host.requests)).toEqual(new Set([STATUS_MESSAGE]));
	});
});
