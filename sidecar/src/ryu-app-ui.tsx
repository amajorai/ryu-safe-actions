import {
	type ComponentProps,
	useEffect,
	useRef,
	useSyncExternalStore,
} from "react";
import type { CompanionThemeBridge } from "./ryu.d.ts";
import { observeCompanionLocalization } from "./ryu-dom-localizer.ts";
import {
	i18nSnapshot,
	startCompanionI18n,
	useI18nRevision,
} from "./ryu-i18n.ts";
import styles from "./safe-actions.module.css";

export const RYU_APP_UI_VERSION = "v1" as const;

export type RyuAppSurface = "standard" | "editor" | "canvas";

/**
 * Safe Actions is a standalone static satellite. This adapter keeps its
 * root API identical to the Ryu App UI kit while its standalone CSS maps the
 * same semantic tokens; the public satellite can therefore build without the
 * private monorepo packages. Its shell follows the host's language and
 * direction through `window.ryu.i18n` (see `ryu-i18n.ts`) and localizes the
 * rendered English literals through the host's catalog.
 */
export function markCompanionAppRoot(
	root: HTMLElement | null,
	options: { surface?: RyuAppSurface } = {}
): void {
	if (!root) {
		return;
	}
	root.dataset.ryuAppUi = RYU_APP_UI_VERSION;
	root.dataset.ryuSurface = options.surface ?? "standard";
	root.classList.add("ryu-app-root");
}

export function subscribeCompanionTheme(
	bridge: CompanionThemeBridge | undefined = "window" in globalThis
		? window.ryu
		: undefined
): () => void {
	const subscribeTheme = bridge?.shell?.subscribeTheme;
	if (!subscribeTheme) {
		return () => undefined;
	}
	const subscription = subscribeTheme({
		onChange: (tokens) => {
			for (const [name, value] of Object.entries(tokens)) {
				if (name.startsWith("--")) {
					document.documentElement.style.setProperty(name, value);
				}
			}
		},
	});
	return () => subscription.dispose();
}

interface RyuAppShellProps extends ComponentProps<"div"> {
	density?: "compact" | "comfortable";
	surface?: RyuAppSurface;
}

function timezoneSnapshot(): string {
	try {
		return (
			getComputedStyle(document.documentElement)
				.getPropertyValue("--ryu-timezone")
				.trim() || "system"
		);
	} catch {
		return "system";
	}
}

function subscribeTimezone(onChange: () => void): () => void {
	if (!("document" in globalThis && "MutationObserver" in globalThis)) {
		return () => undefined;
	}
	const observer = new MutationObserver(onChange);
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["style"],
	});
	return () => observer.disconnect();
}

export function RyuAppShell({
	children,
	className,
	density = "compact",
	surface = "standard",
	...props
}: RyuAppShellProps) {
	useSyncExternalStore(subscribeTimezone, timezoneSnapshot, () => "system");
	useI18nRevision();
	const { direction, locale } = i18nSnapshot();
	const shellRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const shell = shellRef.current;
		const stopI18n = startCompanionI18n();
		const stopLocalizer = shell
			? observeCompanionLocalization(shell)
			: () => undefined;
		return () => {
			stopLocalizer();
			stopI18n();
		};
	}, []);
	return (
		<div
			{...props}
			className={
				className
					? `${styles["ryu-app-shell"]} ${className}`
					: styles["ryu-app-shell"]
			}
			data-density={density}
			data-ryu-app-ui={RYU_APP_UI_VERSION}
			data-ryu-surface={surface}
			dir={direction}
			lang={locale}
			ref={shellRef}
		>
			{children}
		</div>
	);
}
