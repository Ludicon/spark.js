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
