import { defineConfig } from "vite"
import { resolve } from "path"
import basicSsl from "@vitejs/plugin-basic-ssl"

export default defineConfig({
  plugins: [basicSsl()],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.js"),
      name: "SparkTC",
      fileName: format => `index.${format == "es" ? "esm" : format}.js`,
      formats: ["es"]
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {}
      }
    },
    target: "es2022",
    emptyOutDir: true,
    sourcemap: false,
    minify: false
  }
})
