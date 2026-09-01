import type { ComponentProps } from "react";
import type { CompanionThemeBridge } from "./ryu.d.ts";

export const RYU_APP_UI_VERSION = "v1" as const;

export type RyuAppSurface = "standard" | "editor" | "canvas";

/**
 * Safe Actions is a dependency-free static satellite. This adapter keeps its
 * root API identical to the Ryu App UI kit while its standalone CSS maps the
 * same semantic tokens; the public satellite can therefore build without the
 * private monorepo packages.
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
	bridge: CompanionThemeBridge | undefined = typeof window === "undefined"
		? undefined
		: window.ryu
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

export function RyuAppShell({
	children,
	className,
	density = "compact",
	surface = "standard",
	...props
}: RyuAppShellProps) {
	return (
		<div
			{...props}
			className={className ? `ryu-app-shell ${className}` : "ryu-app-shell"}
			data-density={density}
			data-ryu-app-ui={RYU_APP_UI_VERSION}
			data-ryu-surface={surface}
		>
			{children}
		</div>
	);
}
