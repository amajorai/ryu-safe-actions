import { z } from "zod";
export type SafeActionsRequestValue =
	| string
	| number
	| boolean
	| null
	| undefined
	| SafeActionsRequestValue[]
	| { [key: string]: SafeActionsRequestValue };

export type SafeActionsJson = z.core.util.JSONType;
export type SafeActionsJsonDocument = Record<string, SafeActionsJson>;
const objectAdmission = z.custom<object>(
	(value) => z.looseObject({}).safeParse(value).success
);
export const safeActionsNumberSchema = z.union([
	z.number(),
	z.literal(Number.POSITIVE_INFINITY),
	z.literal(Number.NEGATIVE_INFINITY),
]);
const atomicJson = z.union([
	z.null(),
	z.boolean(),
	z.string(),
	safeActionsNumberSchema,
]);
interface JsonValidationFrame {
	leave?: object;
	value: Parameters<typeof atomicJson.safeParse>[0];
}
/** Traverse native JSON without imposing a JavaScript call-stack depth limit. */
function isJson(
	value: Parameters<typeof atomicJson.safeParse>[0],
	scalars: z.ZodType = atomicJson
): boolean {
	const pending: JsonValidationFrame[] = [{ value }];
	const active = new WeakSet<object>();
	while (pending.length) {
		const frame = pending.pop();
		if (!frame) {
			return false;
		}
		if (frame.leave) {
			active.delete(frame.leave);
			continue;
		}
		if (scalars.safeParse(frame.value).success) {
			continue;
		}
		const admission = objectAdmission.safeParse(frame.value);
		if (!(Array.isArray(frame.value) || admission.success)) {
			return false;
		}
		const container = Array.isArray(frame.value) ? frame.value : admission.data;
		if (!container || active.has(container)) {
			return false;
		}
		active.add(container);
		pending.push({ value: null, leave: container });
		for (const entry of Array.isArray(container)
			? container
			: Object.values(container)) {
			pending.push({ value: entry });
		}
	}
	return true;
}
/** Preserve native own keys, overflow numbers and the decoded object's identity. */
export const safeActionsJsonSchema = z.custom<SafeActionsJson>(isJson);
export const safeActionsJsonDocumentSchema = z.custom<SafeActionsJsonDocument>(
	(value) => objectAdmission.safeParse(value).success && isJson(value)
);

export const safeActionsJsonTextSchema = z.string();

const requestScalars = z.union([atomicJson, z.undefined(), z.nan()]);
export const safeActionsRequestValueSchema = z.custom<SafeActionsRequestValue>(
	(value) => isJson(value, requestScalars)
);
