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

// Count texture/buffer allocations made through the device.
function countAllocations(device) {
  const counts = { textures: 0, buffers: 0 }
  const createTexture = device.createTexture.bind(device)
  const createBuffer = device.createBuffer.bind(device)
  device.createTexture = desc => {
    counts.textures++
    return createTexture(desc)
  }
  device.createBuffer = desc => {
    counts.buffers++
    return createBuffer(desc)
  }
  return counts
}

test("Spark: minSize allocates once for a sequence of growing encodes", async () => {
  const device = await createDevice()
  const spark = await Spark.create(device, { cacheTempResources: { minSize: 512 } })
  const format = spark.getSupportedFormats()[0]

  await expectNoValidationErrors(device, async () => {
    const first = await spark.encodeTexture(await makeTestImage(64, 64), { format })
    first.destroy()

    const counts = countAllocations(device)
    for (const size of [128, 256, 512]) {
      const result = await spark.encodeTexture(await makeTestImage(size, size), { format })
      result.destroy()
    }
    // One output texture per encode, no cache reallocations.
    assert.equal(counts.textures, 3, `unexpected texture allocations: ${counts.textures}`)
    assert.equal(counts.buffers, 0, `unexpected buffer allocations: ${counts.buffers}`)
    spark.dispose()
  })
  device.destroy()
})

test("Spark: allocateMipmaps avoids reallocation when mipmaps are requested later", async () => {
  const device = await createDevice()
  const spark = await Spark.create(device, { cacheTempResources: { minSize: 64, allocateMipmaps: true } })
  const format = spark.getSupportedFormats()[0]

  await expectNoValidationErrors(device, async () => {
    const flat = await spark.encodeTexture(await makeTestImage(64, 64), { format })
    flat.destroy()

    const counts = countAllocations(device)
    const mipped = await spark.encodeTexture(await makeTestImage(32, 32), { format, generateMipmaps: true })
    mipped.destroy()
    assert.equal(counts.textures, 1, `unexpected texture allocations: ${counts.textures}`)
    assert.equal(counts.buffers, 0, `unexpected buffer allocations: ${counts.buffers}`)
    spark.dispose()
  })
  device.destroy()
})
