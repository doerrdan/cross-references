import { defineConfig } from "vite";

export default defineConfig({
  base: "./", // works from any sub-path (GitHub Pages, a folder on a web space)
  build: { target: "es2022" },
});
