import { Spark } from "../../src/index.js"
import { test, assert, skip, makeTestImage } from "../harness.js"

async function createDevice() {
  const adapter = await navigator.gpu?.requestAdapter()
  if (!adapter) skip("WebGPU not available")
  const requiredFeatures = Spark.getRequiredFeatures(adapter)
  const device = await adapter.requestDevice({ requiredFeatures })
  return device
}

// Run fn inside a validation error scope and fail if any error was reported.
async function expectNoValidationErrors(device, fn) {
  device.pushErrorScope("validation")
  await fn()
  await device.queue.onSubmittedWorkDone()
  const error = await device.popErrorScope()
  assert.ok(!error, `WebGPU validation error: ${error?.message}`)
}

test("Spark: dispose frees resources without throwing", async () => {
  const device = await createDevice()
  const spark = await Spark.create(device, { cacheTempResources: true })
  const formats = spark.getSupportedFormats()
  assert.ok(formats.length > 0, "no supported formats")

  const image = await makeTestImage()
  await expectNoValidationErrors(device, async () => {
    const texture = await spark.encodeTexture(image, { format: formats[0], generateMipmaps: true })
    assert.ok(texture instanceof GPUTexture, "encode produced no texture")
    texture.destroy()
    spark.dispose()
  })
  device.destroy()
})

test("Spark: dispose before any encode does not throw", async () => {
  const device = await createDevice()
  const spark = await Spark.create(device)
  await expectNoValidationErrors(device, async () => {
    spark.dispose()
  })
  device.destroy()
})

test("Spark: dispose with timestamp queries enabled", async () => {
  const device = await createDevice()
  const spark = await Spark.create(device, { useTimestampQueries: true })
  await expectNoValidationErrors(device, async () => {
    spark.dispose()
  })
  device.destroy()
})
