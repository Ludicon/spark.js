import { defineConfig } from "vite"
import { resolve } from "path"
import { copyFileSync, mkdirSync, readdirSync, statSync } from "fs"
import basicSsl from "@vitejs/plugin-basic-ssl"

// Plugin to copy assets directory
const copyAssetsPlugin = () => ({
  name: "copy-assets",
  closeBundle() {
    const srcDir = resolve(__dirname, "examples/assets")
    const destDir = resolve(__dirname, "dist-examples/assets")

    const copyDir = (src, dest) => {
      mkdirSync(dest, { recursive: true })
      const entries = readdirSync(src, { withFileTypes: true })

      for (const entry of entries) {
        const srcPath = resolve(src, entry.name)
        const destPath = resolve(dest, entry.name)

        if (entry.isDirectory()) {
          copyDir(srcPath, destPath)
        } else {
          copyFileSync(srcPath, destPath)
        }
      }
    }

    copyDir(srcDir, destDir)
  }
})

export default defineConfig({
  plugins: [basicSsl(), copyAssetsPlugin()],
  base: process.env.BASE_PATH || "/spark.js/",
  root: "examples",
  publicDir: resolve(__dirname, "examples/libs"),
  resolve: {
    alias: {
      "@ludicon/spark.js/three-gltf": resolve(__dirname, "src/three-gltf.js"),
      "@ludicon/spark.js": resolve(__dirname, "src/index.js")
    }
  },
  build: {
    outDir: "../dist-examples",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "examples/index.html"),
        basic: resolve(__dirname, "examples/basic.html"),
        mipmaps: resolve(__dirname, "examples/mipmaps.html"),
        svg: resolve(__dirname, "examples/svg.html"),
        "three-basic": resolve(__dirname, "examples/three-basic.html"),
        "three-gltf": resolve(__dirname, "examples/three-gltf.html")
      }
    },
    target: "es2022",
    sourcemap: false,
    minify: true
  }
})
