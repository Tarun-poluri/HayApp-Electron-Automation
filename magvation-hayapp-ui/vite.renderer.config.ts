import { defineConfig } from "vite";
import { resolve } from "path";

// Ensure both renderer entry HTML files are included in the build output so
// the packaged app can load the secondary window HTML (index-secondary.html).
export default defineConfig({
	build: {
		rollupOptions: {
			input: {
				main: resolve(__dirname, "index.html"),
				secondary: resolve(__dirname, "index-secondary.html"),
			},
		},
	},
});
