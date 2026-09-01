// Minimal in-page test runner. Results are collected in window.__results and
// window.__done is set when finished; tests/run.test.js reads them from Node.

const tests = []

export function test(name, fn) {
  tests.push({ name, fn })
}

export const assert = {
  ok(value, message = "expected truthy value") {
    if (!value) throw new Error(message)
  },
  equal(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message ?? `expected ${String(expected)}, got ${String(actual)}`)
    }
  },
  async rejects(promise, pattern) {
    try {
      await promise
    } catch (err) {
      if (pattern && !pattern.test(String(err?.message ?? err))) {
        throw new Error(`rejected with unexpected error: ${err}`)
      }
      return
    }
    throw new Error("expected promise to reject")
  }
}

// A test can call skip(reason) to mark itself as skipped.
export class Skip extends Error {}
export function skip(reason) {
  throw new Skip(reason)
}

export async function run() {
  const results = []
  const output = document.getElementById("output")

  const report = r => {
    results.push(r)
    const status = r.skipped ? "skip" : r.ok ? "ok  " : "FAIL"
    output.textContent += `${status} ${r.name}${r.error ? "\n     " + r.error : ""}\n`
  }

  // Any exception that escapes a test is a failure, even if the test itself passed.
  window.addEventListener("error", e => report({ name: "uncaught error", ok: false, error: String(e.message) }))
  window.addEventListener("unhandledrejection", e => report({ name: "unhandled rejection", ok: false, error: String(e.reason?.stack ?? e.reason) }))

  for (const { name, fn } of tests) {
    try {
      await fn()
      report({ name, ok: true })
    } catch (err) {
      if (err instanceof Skip) {
        report({ name, ok: true, skipped: true, error: err.message })
      } else {
        report({ name, ok: false, error: String(err?.stack ?? err) })
      }
    }
  }

  // Give pending unhandled rejections a chance to surface.
  await new Promise(r => setTimeout(r, 100))

  window.__results = results
  window.__done = true
}

/** True when WebGL runs on SwiftShader, whose emulated compressed formats are unreliable at mip levels above 0. */
export function isSoftwareGL(gl) {
  const ext = gl.getExtension("WEBGL_debug_renderer_info")
  const renderer = gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)
  return /SwiftShader|llvmpipe/i.test(renderer)
}

/** A small opaque ImageBitmap to encode. */
export async function makeTestImage(width = 16, height = 16) {
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext("2d")
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, "#ff0000")
  gradient.addColorStop(1, "#0000ff")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
  return createImageBitmap(canvas)
}

/** A solid-colour ImageBitmap, e.g. makeSolidImage(64, "#ff0000"). */
export async function makeSolidImage(size, color) {
  const canvas = new OffscreenCanvas(size, size)
  const ctx = canvas.getContext("2d")
  ctx.fillStyle = color
  ctx.fillRect(0, 0, size, size)
  return createImageBitmap(canvas)
}

/** An ImageBitmap whose top half is `top` and bottom half is `bottom`. */
export async function makeTwoToneImage(size, top, bottom) {
  const canvas = new OffscreenCanvas(size, size)
  const ctx = canvas.getContext("2d")
  ctx.fillStyle = top
  ctx.fillRect(0, 0, size, size / 2)
  ctx.fillStyle = bottom
  ctx.fillRect(0, size / 2, size, size / 2)
  return createImageBitmap(canvas)
}

/** A deterministic noise ImageBitmap (seeded LCG), so edge/mip differences are visible. */
export async function makeNoiseImage(width, height, seed = 1) {
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext("2d")
  const data = ctx.createImageData(width, height)
  let x = seed >>> 0
  for (let i = 0; i < data.data.length; i += 4) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0
    data.data[i] = x & 255
    data.data[i + 1] = (x >>> 8) & 255
    data.data[i + 2] = (x >>> 16) & 255
    data.data[i + 3] = 255
  }
  ctx.putImageData(data, 0, 0)
  return createImageBitmap(canvas)
}

/** Compare two Uint8Arrays; returns null if equal, else a short description of the first difference. */
export function firstDifference(a, b) {
  if (a.length !== b.length) return `length ${a.length} vs ${b.length}`
  let count = 0
  let first = -1
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      if (first < 0) first = i
      count++
    }
  }
  return first < 0 ? null : `${count} bytes differ, first at byte ${first} (${a[first]} vs ${b[first]})`
}
