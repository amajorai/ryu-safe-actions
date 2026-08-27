import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import {
	markCompanionAppRoot,
	RyuAppShell,
	subscribeCompanionTheme,
} from "./ryu-app-ui.tsx";
import "./safe-actions.css";

const root = document.getElementById("ryu-plugin-root");
if (!root) {
	throw new Error("Safe Actions mount root is missing.");
}

markCompanionAppRoot(root);
subscribeCompanionTheme();

createRoot(root).render(
	<StrictMode>
		<RyuAppShell>
			<App />
		</RyuAppShell>
	</StrictMode>
);
