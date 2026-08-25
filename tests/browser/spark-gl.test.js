import { SparkGL } from "../../src/index.js"
import { test, assert, skip, makeTestImage } from "../harness.js"
import { trackGL } from "../gl-tracker.js"

function createGL() {
  const gl = new OffscreenCanvas(4, 4).getContext("webgl2")
  if (!gl) skip("WebGL2 not available")
  return trackGL(gl)
}

function assertNoLeaks(tracker) {
  assert.equal(tracker.gl.getError(), tracker.gl.NO_ERROR, "GL error after dispose")
  assert.equal(tracker.live.size, 0, `leaked GL resources: ${tracker.describe()}`)
}

test("SparkGL: dispose frees all resources", async () => {
  const tracker = createGL()
  const spark = SparkGL.create(tracker.gl, { cacheTempResources: true })
  const formats = spark.getSupportedFormats()
  assert.ok(formats.length > 0, "no supported formats")

  const image = await makeTestImage()
  const result = await spark.encodeTexture(image, { format: formats[0], generateMipmaps: true })
  assert.ok(result.texture, "encode produced no texture")
  tracker.gl.deleteTexture(result.texture)

  await spark.dispose()
  assertNoLeaks(tracker)
})

test("SparkGL: dispose before any encode does not leak", async () => {
  const tracker = createGL()
  const spark = SparkGL.create(tracker.gl)
  await spark.dispose()
  assertNoLeaks(tracker)
})

test("SparkGL: dispose while a program is compiling rejects the encode cleanly", async () => {
  const tracker = createGL()
  const spark = SparkGL.create(tracker.gl)
  const format = "rgb"

  const image = await makeTestImage()
  const pending = spark.encodeTexture(image, { format })
  await spark.dispose()

  await assert.rejects(pending, /disposed/)
  assertNoLeaks(tracker)
})

test("SparkGL: dispose can be called twice", async () => {
  const tracker = createGL()
  const spark = SparkGL.create(tracker.gl, { cacheTempResources: true })
  const image = await makeTestImage()
  const result = await spark.encodeTexture(image, { format: "rgb" })
  tracker.gl.deleteTexture(result.texture)

  await spark.dispose()
  await spark.dispose()
  assertNoLeaks(tracker)
})

test("SparkGL: encode without cacheTempResources leaves only the output texture", async () => {
  const tracker = createGL()
  const spark = SparkGL.create(tracker.gl)
  const image = await makeTestImage()
  const before = tracker.live.size
  const result = await spark.encodeTexture(image, { format: "rgb", generateMipmaps: true })
  const after = tracker.live.size
  // Program + vertex shader are cached; the output texture belongs to the caller.
  const owned = [...tracker.live.entries()].filter(([, kind]) => kind === "Texture")
  assert.equal(owned.length, 1, `unexpected live textures: ${tracker.describe()}`)
  assert.ok(after > before, "expected some cached resources")

  tracker.gl.deleteTexture(result.texture)
  await spark.dispose()
  assertNoLeaks(tracker)
})

test("SparkGL: repeated encodes with cacheTempResources do not grow resource count", async () => {
  const tracker = createGL()
  const spark = SparkGL.create(tracker.gl, { cacheTempResources: true })
  const format = "rgb"
  const image = await makeTestImage()

  const encode = async () => {
    const result = await spark.encodeTexture(image, { format, generateMipmaps: true })
    tracker.gl.deleteTexture(result.texture)
  }

  await encode()
  const steady = tracker.live.size
  await encode()
  await encode()
  assert.equal(tracker.live.size, steady, `resource count grew: ${tracker.describe()}`)

  await spark.dispose()
  assertNoLeaks(tracker)
})
