import { Spark } from "../../src/index.js"
import { test, assert, skip, makeTestImage, makeSolidImage, makeTwoToneImage, makeNoiseImage, firstDifference } from "../harness.js"

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
  const format = "rgb"

  await expectNoValidationErrors(device, async () => {
    const first = await spark.encodeTexture(await makeTestImage(64, 64), { format })
    first.destroy()

    const counts = countAllocations(device)
    for (const size of [128, 256, 512]) {
      const result = await spark.encodeTexture(await makeTestImage(size, size), { format })
      result.destroy()
    }
    // Per encode: the output texture and the source texture (exact size, so reallocated for
    // each new size). The output buffer must not be reallocated.
    assert.equal(counts.textures, 6, `unexpected texture allocations: ${counts.textures}`)
    assert.equal(counts.buffers, 0, `unexpected buffer allocations: ${counts.buffers}`)
    spark.dispose()
  })
  device.destroy()
})

test("Spark: allocateMipmaps avoids reallocation when mipmaps are requested later", async () => {
  const device = await createDevice()
  const spark = await Spark.create(device, { cacheTempResources: { minSize: 64, allocateMipmaps: true } })
  const format = "rgb"

  await expectNoValidationErrors(device, async () => {
    const flat = await spark.encodeTexture(await makeTestImage(64, 64), { format })
    flat.destroy()

    const counts = countAllocations(device)
    const mipped = await spark.encodeTexture(await makeTestImage(64, 64), { format, generateMipmaps: true })
    mipped.destroy()
    assert.equal(counts.textures, 1, `unexpected texture allocations: ${counts.textures}`)
    assert.equal(counts.buffers, 0, `unexpected buffer allocations: ${counts.buffers}`)
    spark.dispose()
  })
  device.destroy()
})

// Decode one mip level of a compressed texture to RGBA8 by sampling it in a render pass.
async function readTexture(device, texture, width, height, level = 0) {
  const module = device.createShaderModule({
    code: `
      @vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
        let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
        return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
      }
      @group(0) @binding(0) var t: texture_2d<f32>;
      @fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
        return textureLoad(t, vec2i(pos.xy), 0);
      }`
  })
  const pipeline = await device.createRenderPipelineAsync({
    layout: "auto",
    vertex: { module, entryPoint: "vs" },
    fragment: { module, entryPoint: "fs", targets: [{ format: "rgba8unorm" }] }
  })
  const target = device.createTexture({
    size: [width, height],
    format: "rgba8unorm",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
  })
  const bytesPerRow = Math.ceil((width * 4) / 256) * 256
  const buffer = device.createBuffer({ size: bytesPerRow * height, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ })
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: texture.createView({ baseMipLevel: level, mipLevelCount: 1 }) }]
  })

  const encoder = device.createCommandEncoder()
  const pass = encoder.beginRenderPass({
    colorAttachments: [{ view: target.createView(), loadOp: "clear", storeOp: "store" }]
  })
  pass.setPipeline(pipeline)
  pass.setBindGroup(0, bindGroup)
  pass.draw(3)
  pass.end()
  encoder.copyTextureToBuffer({ texture: target }, { buffer, bytesPerRow }, [width, height])
  device.queue.submit([encoder.finish()])

  await buffer.mapAsync(GPUMapMode.READ)
  const mapped = new Uint8Array(buffer.getMappedRange())
  const pixels = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    pixels.set(mapped.subarray(y * bytesPerRow, y * bytesPerRow + width * 4), y * width * 4)
  }
  buffer.unmap()
  buffer.destroy()
  target.destroy()
  return pixels
}

function assertSolid(pixels, [r, g, b], label, tolerance = 8) {
  for (let i = 0; i < pixels.length; i += 4) {
    const ok = Math.abs(pixels[i] - r) <= tolerance && Math.abs(pixels[i + 1] - g) <= tolerance && Math.abs(pixels[i + 2] - b) <= tolerance
    if (!ok) {
      throw new Error(`${label}: pixel ${i / 4} is (${pixels[i]}, ${pixels[i + 1]}, ${pixels[i + 2]}), expected (${r}, ${g}, ${b})`)
    }
  }
}

test("Spark: concurrent encodes with cacheTempResources do not interfere", async () => {
  const device = await createDevice()
  // No preload: the first encode waits for the pipeline to compile, which is when a
  // concurrent encode can reuse or reallocate the cached resources underneath it.
  const spark = await Spark.create(device, { cacheTempResources: true })
  const format = "rgb"

  await expectNoValidationErrors(device, async () => {
    const [red, green] = await Promise.all([
      spark.encodeTexture(await makeSolidImage(64, "#ff0000"), { format }),
      spark.encodeTexture(await makeSolidImage(128, "#00ff00"), { format })
    ])
    assertSolid(await readTexture(device, red, 64, 64), [255, 0, 0], "red")
    assertSolid(await readTexture(device, green, 128, 128), [0, 255, 0], "green")
    red.destroy()
    green.destroy()
    spark.dispose()
  })
  device.destroy()
})

function assertAlpha(pixels, expected, label, tolerance = 8) {
  for (let i = 3; i < pixels.length; i += 4) {
    if (Math.abs(pixels[i] - expected) > tolerance) {
      throw new Error(`${label}: pixel ${(i - 3) / 4} alpha is ${pixels[i]}, expected ${expected}`)
    }
  }
}

test("Spark: mipsAlphaScale applies a different scale to each mip level", async () => {
  const device = await createDevice()
  const spark = await Spark.create(device)

  await expectNoValidationErrors(device, async () => {
    // Solid white at 50% alpha; levels are 32, 16, 8, 4.
    const image = await makeSolidImage(32, "rgba(255, 255, 255, 0.5)")
    const texture = await spark.encodeTexture(image, {
      format: "rgba",
      generateMipmaps: true,
      mipmapFilter: "box",
      mipsAlphaScale: [1.0, 0.5]
    })
    assert.equal(texture.mipLevelCount, 4, "unexpected mip count")

    // Each level is derived from the previous one, so the scales compound:
    // level 1 = 128 * 1.0, level 2 = 128 * 0.5, level 3 = 64 * 0.5 (last scale repeats).
    assertAlpha(await readTexture(device, texture, 32, 32, 0), 128, "level 0")
    assertAlpha(await readTexture(device, texture, 16, 16, 1), 128, "level 1")
    assertAlpha(await readTexture(device, texture, 8, 8, 2), 64, "level 2")
    assertAlpha(await readTexture(device, texture, 4, 4, 3), 32, "level 3")
    texture.destroy()
    spark.dispose()
  })
  device.destroy()
})

function pixelAt(pixels, width, x, y) {
  const i = (y * width + x) * 4
  return [pixels[i], pixels[i + 1], pixels[i + 2]]
}

function assertColor([r, g, b], [er, eg, eb], label, tolerance = 8) {
  assert.ok(
    Math.abs(r - er) <= tolerance && Math.abs(g - eg) <= tolerance && Math.abs(b - eb) <= tolerance,
    `${label}: got (${r}, ${g}, ${b}), expected (${er}, ${eg}, ${eb})`
  )
}

test("Spark: cached resources are not reused for a smaller image with flipY", async () => {
  const device = await createDevice()
  const spark = await Spark.create(device, { cacheTempResources: true })
  const format = "rgb"

  await expectNoValidationErrors(device, async () => {
    // Top half red, bottom half green. flipY goes through the cached tmp texture.
    const big = await spark.encodeTexture(await makeTwoToneImage(128, "#ff0000", "#00ff00"), { format, flipY: true })
    big.destroy()

    const small = await spark.encodeTexture(await makeTwoToneImage(64, "#ff0000", "#00ff00"), { format, flipY: true })
    const pixels = await readTexture(device, small, 64, 64)
    // Flipped: row 0 of the texture is the bottom (green) half of the image.
    assertColor(pixelAt(pixels, 64, 0, 0), [0, 255, 0], "top-left")
    assertColor(pixelAt(pixels, 64, 63, 0), [0, 255, 0], "top-right")
    assertColor(pixelAt(pixels, 64, 0, 63), [255, 0, 0], "bottom-left")
    assertColor(pixelAt(pixels, 64, 63, 63), [255, 0, 0], "bottom-right")
    small.destroy()
    spark.dispose()
  })
  device.destroy()
})

const CONSISTENCY_SHAPES = [
  [1024, 256],
  [128, 64]
]

// Encode each shape with mipmaps and decode every level.
async function encodeAndDecodeAll(device, spark, images, options) {
  const results = []
  for (const image of images) {
    const texture = await spark.encodeTexture(image, { format: "rgb", generateMipmaps: true, ...options })
    const levels = []
    for (let level = 0; level < texture.mipLevelCount; level++) {
      const w = Math.max(1, image.width >> level)
      const h = Math.max(1, image.height >> level)
      levels.push(await readTexture(device, texture, w, h, level))
    }
    texture.destroy()
    results.push(levels)
  }
  return results
}

for (const mipmapFilter of ["box", "magic"]) {
  test(`Spark: cacheTempResources does not change the encoded result (${mipmapFilter} filter)`, async () => {
    const device = await createDevice()
    const images = await Promise.all(CONSISTENCY_SHAPES.map(([w, h], i) => makeNoiseImage(w, h, i + 1)))

    await expectNoValidationErrors(device, async () => {
      const plain = await Spark.create(device)
      const expected = await encodeAndDecodeAll(device, plain, images, { mipmapFilter })
      plain.dispose()

      // Size the cache with a large, contrasting encode first, then encode the test shapes.
      const cached = await Spark.create(device, { cacheTempResources: true })
      const big = await cached.encodeTexture(await makeSolidImage(1024, "#ff00ff"), { format: "rgb", generateMipmaps: true })
      big.destroy()
      const actual = await encodeAndDecodeAll(device, cached, images, { mipmapFilter })
      cached.dispose()

      for (let i = 0; i < images.length; i++) {
        assert.equal(actual[i].length, expected[i].length, `mip count differs for ${images[i].width}x${images[i].height}`)
        for (let level = 0; level < expected[i].length; level++) {
          const diff = firstDifference(actual[i][level], expected[i][level])
          assert.ok(!diff, `${images[i].width}x${images[i].height} level ${level}: ${diff}`)
        }
      }
    })
    device.destroy()
  })
}
