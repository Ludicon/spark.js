#!/usr/bin/env node

import { build } from "vite"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { mkdirSync, writeFileSync, rmSync } from "fs"
import { gzip, brotliCompress } from "zlib"
import { promisify } from "util"

const gzipAsync = promisify(gzip)
const brotliAsync = promisify(brotliCompress)

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, "..")
const tempDir = resolve(rootDir, ".temp-bundle-analysis")

// Test cases for tree-shaking analysis
const testCases = [
  {
    name: "WebGPU only (Spark)",
    code: `import { Spark } from '@ludicon/spark.js';
const adapter = await navigator.gpu.requestAdapter();
const features = Spark.getRequiredFeatures(adapter);
const device = await adapter.requestDevice({ requiredFeatures: features });
const spark = await Spark.create(device);
const texture = await spark.encodeTexture('image.png');
console.log(spark, texture);`
  },
  {
    name: "WebGL only (SparkGL)",
    code: `import { SparkGL } from '@ludicon/spark.js';
const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl2');
const spark = SparkGL.create(gl);
const result = await spark.encodeTexture('image.png');
console.log(spark, result);`
  },
  {
    name: "Both WebGPU and WebGL",
    code: `import { Spark, SparkGL } from '@ludicon/spark.js';
const adapter = await navigator.gpu.requestAdapter();
const features = Spark.getRequiredFeatures(adapter);
const device = await adapter.requestDevice({ requiredFeatures: features });
const spark = await Spark.create(device);
const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl2');
const sparkGL = SparkGL.create(gl);
console.log(spark, sparkGL);`
  }
]

async function getCompressedSize(code) {
  const buffer = Buffer.from(code, "utf-8")
  const gzipped = await gzipAsync(buffer)
  const brotli = await brotliAsync(buffer)
  return {
    raw: buffer.length,
    gzip: gzipped.length,
    brotli: brotli.length
  }
}

async function analyzeBundle(testCase, index) {
  const entryDir = resolve(tempDir, `test-${index}`)
  const outDir = resolve(tempDir, `out-${index}`)

  mkdirSync(entryDir, { recursive: true })

  const entryFile = resolve(entryDir, "entry.js")
  writeFileSync(entryFile, testCase.code)

  try {
    await build({
      configFile: false,
      root: entryDir,
      resolve: {
        alias: {
          "@ludicon/spark.js/three-gltf": resolve(rootDir, "src/three-gltf.js"),
          "@ludicon/spark.js": resolve(rootDir, "src/index.js")
        }
      },
      build: {
        lib: {
          entry: entryFile,
          formats: ["es"],
          fileName: () => "bundle.js"
        },
        outDir,
        rollupOptions: {
          external: ["three"],
          output: {
            inlineDynamicImports: true
          }
        },
        minify: "terser",
        terserOptions: {
          compress: {
            passes: 2,
            pure_getters: true,
            unsafe: true
          },
          mangle: {
            toplevel: true
          }
        },
        target: "es2022",
        emptyOutDir: true,
        write: true
      },
      logLevel: "error"
    })

    const { readFileSync } = await import("fs")
    const bundlePath = resolve(outDir, "bundle.js")
    const bundleCode = readFileSync(bundlePath, "utf-8")
    const sizes = await getCompressedSize(bundleCode)

    return sizes
  } catch (error) {
    console.error(`Error building ${testCase.name}:`, error.message)
    return null
  }
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(2)} KB`
}

function generateMarkdownReport(results) {
  const date = new Date().toISOString().split("T")[0]

  return `# Bundle Size Analysis

This document shows the tree-shaken bundle sizes for different usage scenarios of spark.js.

## Current Bundle Sizes

Last updated: ${date}

| Usage Scenario | Raw | Gzip | Brotli |
|----------------|-----|------|--------|
| **WebGPU only** (Spark) | ${formatBytes(results[0].sizes.raw)} | ${formatBytes(results[0].sizes.gzip)} | ${formatBytes(results[0].sizes.brotli)} |
| **WebGL only** (SparkGL) | ${formatBytes(results[1].sizes.raw)} | ${formatBytes(results[1].sizes.gzip)} | ${formatBytes(results[1].sizes.brotli)} |
| **Both WebGPU and WebGL** | ${formatBytes(results[2].sizes.raw)} | ${formatBytes(results[2].sizes.gzip)} | ${formatBytes(results[2].sizes.brotli)} |
`
}

async function main() {
  console.log("🔍 Analyzing bundle sizes for tree-shaking verification...\n")

  // Clean up temp directory
  rmSync(tempDir, { recursive: true, force: true })
  mkdirSync(tempDir, { recursive: true })

  const results = []

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i]
    process.stdout.write(`Analyzing: ${testCase.name}... `)

    const sizes = await analyzeBundle(testCase, i)

    if (sizes) {
      results.push({ name: testCase.name, sizes })
      console.log("✓")
    } else {
      console.log("✗")
    }
  }

  // Clean up temp directory
  rmSync(tempDir, { recursive: true, force: true })

  console.log("\n📊 Bundle Size Results:\n")
  console.log("=".repeat(80))

  results.forEach(result => {
    console.log(`${result.name}`)
    console.log(`  Raw:    ${formatBytes(result.sizes.raw)}`)
    console.log(`  Gzip:   ${formatBytes(result.sizes.gzip)}`)
    console.log(`  Brotli: ${formatBytes(result.sizes.brotli)}`)
    console.log()
  })

  console.log("=".repeat(80))

  // Calculate overhead
  if (results.length >= 3) {
    const webgpuOnly = results[0].sizes
    const webglOnly = results[1].sizes
    const both = results[2].sizes

    console.log("\n🔬 Tree-shaking Analysis:\n")

    const webgpuOverhead = (((both.gzip - webglOnly.gzip) / webglOnly.gzip) * 100).toFixed(1)
    const webglOverhead = (((both.gzip - webgpuOnly.gzip) / webgpuOnly.gzip) * 100).toFixed(1)

    console.log(`WebGPU overhead when using WebGL: ${formatBytes(both.gzip - webglOnly.gzip)} (+${webgpuOverhead}%)`)
    console.log(`WebGL overhead when using WebGPU: ${formatBytes(both.gzip - webgpuOnly.gzip)} (+${webglOverhead}%)`)

    const expectedBothSize = webgpuOnly.gzip + webglOnly.gzip
    const actualSharedSavings = expectedBothSize - both.gzip
    const sharedPercentage = ((actualSharedSavings / expectedBothSize) * 100).toFixed(1)

    console.log(`\nShared code size: ~${formatBytes(actualSharedSavings)} (~${sharedPercentage}% of combined)`)
  }

  // Generate and save markdown report
  console.log("\n📝 Generating BUNDLE-SIZE.md report...")
  const markdown = generateMarkdownReport(results)
  const reportPath = resolve(rootDir, "BUNDLE-SIZE.md")
  writeFileSync(reportPath, markdown, "utf-8")
  console.log("   ✓ Report saved to BUNDLE-SIZE.md")

  console.log("\n✨ Analysis complete!\n")
}

main().catch(error => {
  console.error("Fatal error:", error)
  process.exit(1)
})
