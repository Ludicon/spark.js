import { defineConfig } from "vite"
import { resolve } from "path"
import basicSsl from "@vitejs/plugin-basic-ssl"
import summary from 'rollup-plugin-summary';

export default defineConfig({
  plugins: [basicSsl()],
  server: {
    https: process.env.HTTPS == "true"
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.js"),
      name: "spark",
      fileName: format => `spark.${format == "es" ? "esm" : format}.js`,
      formats: ["es"]
    },
    rollupOptions: {
      external: ["three"],
      plugins: [summary({showGzippedSize:true, showBrotliSize:true})],
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
