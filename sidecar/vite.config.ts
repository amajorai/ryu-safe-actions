import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	root: here,
	base: "./",
	build: {
		outDir: "dist",
		emptyOutDir: true,
		target: "esnext",
		rollupOptions: {
			input: { safeActions: resolve(here, "index.html") },
		},
	},
});
