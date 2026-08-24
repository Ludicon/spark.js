// Runs the browser test page in headless Chromium and reports each result through node:test.
// Usage: npm test

import { test } from "node:test"
import assert from "node:assert/strict"
import { createServer } from "vite"
import { chromium } from "playwright"

const server = await createServer({
  configFile: false,
  root: process.cwd(),
  server: { port: 0, https: false },
  logLevel: "error"
})
await server.listen()
const port = server.config.server.port ?? server.httpServer.address().port
const url = `http://localhost:${port}/tests/harness.html`

const browser = await chromium.launch({
  args: ["--enable-unsafe-webgpu", "--ignore-gpu-blocklist", "--enable-features=Vulkan"]
})
const page = await browser.newPage()

const pageErrors = []
page.on("pageerror", err => pageErrors.push(String(err)))
page.on("console", msg => {
  if (msg.type() === "error" || msg.type() === "warning") console.log(`[browser ${msg.type()}] ${msg.text()}`)
})

let results = []
try {
  await page.goto(url)
  await page.waitForFunction(() => window.__done, null, { timeout: 60_000 })
  results = await page.evaluate(() => window.__results)
} finally {
  await browser.close()
  await server.close()
}

for (const r of results) {
  test(r.name, { skip: r.skipped ? r.error : false }, () => {
    assert.ok(r.ok, r.error)
  })
}

test("no uncaught page errors", () => {
  assert.deepEqual(pageErrors, [])
})
