import { SparkGL } from "../../src/index.js"
import { test, assert, skip, isSoftwareGL, makeSolidImage, makeNoiseImage, firstDifference } from "../harness.js"
import { trackGL } from "../gl-tracker.js"

function createGL() {
  const gl = new OffscreenCanvas(4, 4).getContext("webgl2")
  if (!gl) skip("WebGL2 not available")
  if (isSoftwareGL(gl)) skip("compressed mip levels are not reliable on software GL")
  return trackGL(gl)
}

// Decode one mip level of a compressed texture back to RGBA8 by rendering it with texelFetch.
function readMipLevel(gl, texture, level, width, height) {
  const vs = `#version 300 es
    void main() {
      vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
      gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
    }`
  const fs = `#version 300 es
    precision mediump float;
    uniform sampler2D uTexture;
    uniform int uLevel;
    out vec4 fragColor;
    void main() {
      fragColor = texelFetch(uTexture, ivec2(gl_FragCoord.xy), uLevel);
    }`
  const compile = (type, src) => {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, src)
    gl.compileShader(shader)
    return shader
  }
  const vsShader = compile(gl.VERTEX_SHADER, vs)
  const fsShader = compile(gl.FRAGMENT_SHADER, fs)
  const program = gl.createProgram()
  gl.attachShader(program, vsShader)
  gl.attachShader(program, fsShader)
  gl.linkProgram(program)

  const target = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, target)
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height)
  const fbo = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0)

  gl.useProgram(program)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.uniform1i(gl.getUniformLocation(program, "uTexture"), 0)
  gl.uniform1i(gl.getUniformLocation(program, "uLevel"), level)
  gl.viewport(0, 0, width, height)
  gl.drawArrays(gl.TRIANGLES, 0, 3)

  const pixels = new Uint8Array(width * height * 4)
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

  gl.deleteFramebuffer(fbo)
  gl.deleteTexture(target)
  gl.useProgram(null)
  gl.deleteProgram(program)
  gl.deleteShader(vsShader)
  gl.deleteShader(fsShader)
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

// Count createTexture calls: handle counting alone cannot see a delete+create reallocation.
function countTextureCreations(gl) {
  const counter = { count: 0 }
  const raw = gl.createTexture
  gl.createTexture = () => {
    counter.count++
    return raw.call(gl)
  }
  return counter
}

test("SparkGL: cached source texture is reused for an image of the same size", async () => {
  const tracker = createGL()
  const gl = tracker.gl
  const spark = SparkGL.create(gl, { cacheTempResources: true })
  const format = "rgb"

  // First encode sizes the cache and leaves the source texture's base level dirty.
  const red = await spark.encodeTexture(await makeSolidImage(32, "#ff0000"), { format, generateMipmaps: true })
  assertSolid(readMipLevel(gl, red.texture, 0, 32, 32), [255, 0, 0], "red level 0")
  gl.deleteTexture(red.texture)

  const created = countTextureCreations(gl)
  const green = await spark.encodeTexture(await makeSolidImage(32, "#00ff00"), { format, generateMipmaps: true })
  assert.equal(created.count, 1, "expected only the output texture to be created")
  assert.equal(green.mipmapCount, 4, "unexpected mipmap count")
  for (let level = 0; level < 4; level++) {
    const size = 32 >> level
    assertSolid(readMipLevel(gl, green.texture, level, size, size), [0, 255, 0], `green level ${level}`)
  }
  gl.deleteTexture(green.texture)

  await spark.dispose()
  assert.equal(tracker.live.size, 0, `leaked GL resources: ${tracker.describe()}`)
})

test("SparkGL: cached source texture is reallocated for a smaller image", async () => {
  const tracker = createGL()
  const gl = tracker.gl
  const spark = SparkGL.create(gl, { cacheTempResources: true })
  const format = "rgb"

  const red = await spark.encodeTexture(await makeSolidImage(32, "#ff0000"), { format, generateMipmaps: true })
  gl.deleteTexture(red.texture)

  // A larger cached texture must not be reused: its stale content would bleed into edge
  // blocks and mipmaps (https://github.com/Ludicon/spark.js/issues/42).
  const created = countTextureCreations(gl)
  const green = await spark.encodeTexture(await makeSolidImage(16, "#00ff00"), { format, generateMipmaps: true })
  assert.equal(created.count, 2, "expected the output texture and a reallocated source texture")
  for (let level = 0; level < 3; level++) {
    const size = 16 >> level
    assertSolid(readMipLevel(gl, green.texture, level, size, size), [0, 255, 0], `green level ${level}`)
  }
  gl.deleteTexture(green.texture)

  await spark.dispose()
  assert.equal(tracker.live.size, 0, `leaked GL resources: ${tracker.describe()}`)
})

test("SparkGL: cached source texture is reallocated for a larger image", async () => {
  const tracker = createGL()
  const gl = tracker.gl
  const spark = SparkGL.create(gl, { cacheTempResources: true })
  const format = "rgb"

  const small = await spark.encodeTexture(await makeSolidImage(16, "#ff0000"), { format })
  gl.deleteTexture(small.texture)
  const live = tracker.live.size

  const big = await spark.encodeTexture(await makeSolidImage(32, "#0000ff"), { format, generateMipmaps: true })
  // Realloc replaces the cached source texture; only the new output is added.
  assert.equal(tracker.live.size, live + 1, `resource count changed after realloc: ${tracker.describe()}`)
  assertSolid(readMipLevel(gl, big.texture, 0, 32, 32), [0, 0, 255], "blue level 0")
  assertSolid(readMipLevel(gl, big.texture, 3, 4, 4), [0, 0, 255], "blue level 3")
  gl.deleteTexture(big.texture)

  await spark.dispose()
  assert.equal(tracker.live.size, 0, `leaked GL resources: ${tracker.describe()}`)
})

test("SparkGL: minSize allocates once for a sequence of growing encodes", async () => {
  const tracker = createGL()
  const gl = tracker.gl
  const spark = SparkGL.create(gl, { cacheTempResources: { minSize: 512 } })
  const format = "rgb"

  const first = await spark.encodeTexture(await makeSolidImage(64, "#ff0000"), { format })
  gl.deleteTexture(first.texture)

  const created = countTextureCreations(gl)
  let buffersCreated = 0
  const rawCreateBuffer = gl.createBuffer
  gl.createBuffer = () => {
    buffersCreated++
    return rawCreateBuffer.call(gl)
  }
  for (const size of [128, 256, 512]) {
    const result = await spark.encodeTexture(await makeSolidImage(size, "#00ff00"), { format })
    assertSolid(readMipLevel(gl, result.texture, 0, size, size), [0, 255, 0], `${size} level 0`)
    gl.deleteTexture(result.texture)
  }
  // Per encode: the output texture, the source texture (exact size, so reallocated for each
  // new size) and one texture from readMipLevel. The block render target must not be
  // reallocated, nor the readback buffer.
  assert.equal(created.count, 9, `block render target was reallocated: ${created.count} textures created`)
  assert.equal(buffersCreated, 0, `readback buffer was reallocated: ${buffersCreated} buffers created`)

  // Larger than minSize still grows the cache.
  const big = await spark.encodeTexture(await makeSolidImage(1024, "#0000ff"), { format })
  assertSolid(readMipLevel(gl, big.texture, 0, 1024, 1024), [0, 0, 255], "1024 level 0")
  gl.deleteTexture(big.texture)

  await spark.dispose()
  assert.equal(tracker.live.size, 0, `leaked GL resources: ${tracker.describe()}`)
})

test("SparkGL: allocateMipmaps avoids reallocation when mipmaps are requested later", async () => {
  const tracker = createGL()
  const gl = tracker.gl
  const spark = SparkGL.create(gl, { cacheTempResources: { minSize: 64, allocateMipmaps: true } })
  const format = "rgb"

  const flat = await spark.encodeTexture(await makeSolidImage(64, "#ff0000"), { format })
  gl.deleteTexture(flat.texture)

  const created = countTextureCreations(gl)
  const mipped = await spark.encodeTexture(await makeSolidImage(64, "#00ff00"), { format, generateMipmaps: true })
  assert.equal(created.count, 1, "expected only the output texture to be created")
  assertSolid(readMipLevel(gl, mipped.texture, 2, 16, 16), [0, 255, 0], "green level 2")
  gl.deleteTexture(mipped.texture)

  await spark.dispose()
  assert.equal(tracker.live.size, 0, `leaked GL resources: ${tracker.describe()}`)
})

test("SparkGL: without allocateMipmaps the source texture is reallocated once for mipmaps", async () => {
  const tracker = createGL()
  const gl = tracker.gl
  const spark = SparkGL.create(gl, { cacheTempResources: { minSize: 64 } })
  const format = "rgb"

  const flat = await spark.encodeTexture(await makeSolidImage(64, "#ff0000"), { format })
  gl.deleteTexture(flat.texture)

  const created = countTextureCreations(gl)
  const mipped = await spark.encodeTexture(await makeSolidImage(64, "#00ff00"), { format, generateMipmaps: true })
  assert.equal(created.count, 2, "expected output texture plus one source reallocation")
  gl.deleteTexture(mipped.texture)

  // The reallocated source texture has a mip chain, so another mipmapped 64x64 reuses it.
  const again = await spark.encodeTexture(await makeSolidImage(64, "#0000ff"), { format, generateMipmaps: true })
  assert.equal(created.count, 3, "expected no further reallocation")
  assertSolid(readMipLevel(gl, again.texture, 3, 8, 8), [0, 0, 255], "blue level 3")
  gl.deleteTexture(again.texture)

  await spark.dispose()
  assert.equal(tracker.live.size, 0, `leaked GL resources: ${tracker.describe()}`)
})

test("SparkGL: invalid minSize is rejected", async () => {
  const tracker = createGL()
  let threw = false
  try {
    SparkGL.create(tracker.gl, { cacheTempResources: { minSize: -1 } })
  } catch {
    threw = true
  }
  assert.ok(threw, "expected an error for negative minSize")
})

const CONSISTENCY_SHAPES = [
  [1024, 256],
  [128, 64]
]

// Encode each shape with mipmaps and decode every level.
async function encodeAndDecodeAll(gl, spark, images) {
  const results = []
  for (const image of images) {
    const result = await spark.encodeTexture(image, { format: "rgb", generateMipmaps: true })
    const levels = []
    for (let level = 0; level < result.mipmapCount; level++) {
      const w = Math.max(1, image.width >> level)
      const h = Math.max(1, image.height >> level)
      levels.push(readMipLevel(gl, result.texture, level, w, h))
    }
    gl.deleteTexture(result.texture)
    results.push(levels)
  }
  return results
}

test("SparkGL: cacheTempResources does not change the encoded result", async () => {
  const tracker = createGL()
  const gl = tracker.gl
  const images = await Promise.all(CONSISTENCY_SHAPES.map(([w, h], i) => makeNoiseImage(w, h, i + 1)))

  const plain = SparkGL.create(gl)
  const expected = await encodeAndDecodeAll(gl, plain, images)
  await plain.dispose()

  // Size the cache with a large, contrasting encode first, then encode the test shapes.
  const cached = SparkGL.create(gl, { cacheTempResources: true })
  const big = await cached.encodeTexture(await makeSolidImage(1024, "#ff00ff"), { format: "rgb", generateMipmaps: true })
  gl.deleteTexture(big.texture)
  const actual = await encodeAndDecodeAll(gl, cached, images)
  await cached.dispose()

  for (let i = 0; i < images.length; i++) {
    assert.equal(actual[i].length, expected[i].length, `mip count differs for ${images[i].width}x${images[i].height}`)
    for (let level = 0; level < expected[i].length; level++) {
      const diff = firstDifference(actual[i][level], expected[i][level])
      assert.ok(!diff, `${images[i].width}x${images[i].height} level ${level}: ${diff}`)
    }
  }
  assert.equal(tracker.live.size, 0, `leaked GL resources: ${tracker.describe()}`)
})

// Decode all `count` levels of a texture starting at `level`, given the size of that level.
function readLevels(gl, texture, level, width, height, count) {
  const levels = []
  for (let i = 0; i < count; i++) {
    levels.push(readMipLevel(gl, texture, level + i, Math.max(1, width >> i), Math.max(1, height >> i)))
  }
  return levels
}

test("SparkGL: outputMipLevel fills one mip chain across several encodes", async () => {
  const tracker = createGL()
  const gl = tracker.gl
  const spark = SparkGL.create(gl)
  const options = { format: "rgb" }
  const base = await makeNoiseImage(256, 128, 1)
  const preview = await makeNoiseImage(64, 32, 2)
  const full = await makeNoiseImage(256, 128, 3)

  // References: each image encoded on its own.
  const baseRef = await spark.encodeTexture(base, { ...options, mips: true })
  const previewRef = await spark.encodeTexture(preview, { ...options, mips: true })
  const fullRef = await spark.encodeTexture(full, options)
  assert.equal(baseRef.mipmapCount, 2 + previewRef.mipmapCount)

  // The chain to fill, initially holding `base` at every level.
  const chain = await spark.encodeTexture(base, { ...options, mips: true })

  // Pass 1: the preview and its mipmaps go to levels 2 and below.
  const pass1 = await spark.encodeTexture(preview, { ...options, mips: true, outputTexture: chain, outputMipLevel: 2 })
  assert.equal(pass1.texture, chain.texture, "pass 1 did not write into the output texture")
  assert.equal(pass1.width, chain.width, "result should describe the output texture")
  assert.equal(pass1.mipmapCount, chain.mipmapCount, "result should describe the output texture")
  assert.equal(pass1.byteLength, previewRef.byteLength, "byteLength should be the bytes written")

  // Pass 2: the full image, without mipmaps, goes to level 0 only.
  const pass2 = await spark.encodeTexture(full, { ...options, outputTexture: chain, outputMipLevel: 0 })
  assert.equal(pass2.texture, chain.texture, "pass 2 did not write into the output texture")
  assert.equal(pass2.byteLength, fullRef.byteLength, "byteLength should be the bytes written")

  // Level 0 comes from pass 2, level 1 is untouched, levels 2.. come from pass 1.
  const actual = readLevels(gl, chain.texture, 0, 256, 128, chain.mipmapCount)
  const expected = [
    readLevels(gl, fullRef.texture, 0, 256, 128, 1)[0],
    readLevels(gl, baseRef.texture, 1, 128, 64, 1)[0],
    ...readLevels(gl, previewRef.texture, 0, 64, 32, previewRef.mipmapCount)
  ]
  for (let level = 0; level < expected.length; level++) {
    const diff = firstDifference(actual[level], expected[level])
    assert.ok(!diff, `level ${level}: ${diff}`)
  }

  for (const result of [baseRef, previewRef, fullRef, chain]) gl.deleteTexture(result.texture)
  await spark.dispose()
  assert.equal(tracker.live.size, 0, `leaked GL resources: ${tracker.describe()}`)
})

test("SparkGL: outputMipLevel validates the output texture", async () => {
  const tracker = createGL()
  const gl = tracker.gl
  const spark = SparkGL.create(gl)
  const options = { format: "rgb" }
  const image = await makeNoiseImage(64, 32, 1)
  const single = await spark.encodeTexture(image, options) // 64x32, one level

  // Level 1 of `single` is 32x16, not 64x32.
  await assert.rejects(spark.encodeTexture(image, { ...options, outputTexture: single, outputMipLevel: 1 }), /does not fit/)
  // No room for the mip chain below level 0.
  await assert.rejects(spark.encodeTexture(image, { ...options, mips: true, outputTexture: single, outputMipLevel: 0 }), /does not fit/)
  await assert.rejects(spark.encodeTexture(image, { ...options, outputMipLevel: 0 }), /requires an outputTexture/)
  await assert.rejects(spark.encodeTexture(image, { ...options, outputTexture: single, outputMipLevel: -1 }), /non-negative integer/)

  // Without outputMipLevel a mismatch is not an error: a fresh texture is returned.
  const fresh = await spark.encodeTexture(image, { ...options, mips: true, outputTexture: single })
  assert.ok(fresh.texture !== single.texture, "a mismatched hint should allocate a fresh texture")
  // And an exact match is reused.
  const reused = await spark.encodeTexture(image, { ...options, outputTexture: single })
  assert.equal(reused.texture, single.texture, "a matching hint should be reused")

  gl.deleteTexture(single.texture)
  gl.deleteTexture(fresh.texture)
  await spark.dispose()
  assert.equal(tracker.live.size, 0, `leaked GL resources: ${tracker.describe()}`)
})

test("SparkGL: sampler state of a reused output texture is preserved", async () => {
  const tracker = createGL()
  const gl = tracker.gl
  const spark = SparkGL.create(gl)
  const image = await makeNoiseImage(64, 32, 1)
  const result = await spark.encodeTexture(image, { format: "rgb", mips: true })

  gl.bindTexture(gl.TEXTURE_2D, result.texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, 2)
  gl.bindTexture(gl.TEXTURE_2D, null)

  await spark.encodeTexture(image, { format: "rgb", mips: true, outputTexture: result })
  await spark.encodeTexture(await makeNoiseImage(32, 16, 2), { format: "rgb", outputTexture: result, outputMipLevel: 1 })

  gl.bindTexture(gl.TEXTURE_2D, result.texture)
  assert.equal(gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER), gl.NEAREST, "TEXTURE_MIN_FILTER was changed")
  assert.equal(gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S), gl.CLAMP_TO_EDGE, "TEXTURE_WRAP_S was changed")
  assert.equal(gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL), 2, "TEXTURE_BASE_LEVEL was changed")
  gl.bindTexture(gl.TEXTURE_2D, null)

  gl.deleteTexture(result.texture)
  await spark.dispose()
  assert.equal(tracker.live.size, 0, `leaked GL resources: ${tracker.describe()}`)
})

test("SparkGL: mipmapCount limits the generated chain", async () => {
  const tracker = createGL()
  const gl = tracker.gl
  const spark = SparkGL.create(gl)
  const image = await makeNoiseImage(64, 32, 1)
  const options = { format: "rgb", mips: true }

  const full = await spark.encodeTexture(image, options)
  assert.equal(full.mipmapCount, 5, "default chain should stop at 4x4")
  const partial = await spark.encodeTexture(image, { ...options, mipmapCount: 3 })
  assert.equal(partial.mipmapCount, 3)
  const tiny = await spark.encodeTexture(image, { ...options, mipmapCount: 99 })
  assert.equal(tiny.mipmapCount, 7, "explicit count should be clamped to the chain down to 1x1")

  const expected = readLevels(gl, full.texture, 0, 64, 32, 3)
  const actual = readLevels(gl, partial.texture, 0, 64, 32, 3)
  for (let level = 0; level < 3; level++) {
    const diff = firstDifference(actual[level], expected[level])
    assert.ok(!diff, `level ${level}: ${diff}`)
  }
  // The levels shared with the default chain match, and the 1x1 level is the mean colour.
  const tinyLevels = readLevels(gl, tiny.texture, 0, 64, 32, 7)
  const fullLevels = readLevels(gl, full.texture, 0, 64, 32, 5)
  for (let level = 0; level < 5; level++) {
    const diff = firstDifference(tinyLevels[level], fullLevels[level])
    assert.ok(!diff, `level ${level}: ${diff}`)
  }
  assert.equal(tinyLevels[6].length, 4)

  await assert.rejects(spark.encodeTexture(image, { ...options, mipmapCount: 0 }), /positive integer/)
  await assert.rejects(spark.encodeTexture(image, { ...options, mipmapCount: 1.5 }), /positive integer/)

  for (const result of [full, partial, tiny]) gl.deleteTexture(result.texture)
  await spark.dispose()
  assert.equal(tracker.live.size, 0, `leaked GL resources: ${tracker.describe()}`)
})

test("SparkGL: a caller-supplied mip chain is encoded one level per call", async () => {
  const tracker = createGL()
  const gl = tracker.gl
  const spark = SparkGL.create(gl)
  const options = { format: "rgb" }
  const levelCount = 4
  const images = []
  for (let level = 0; level < levelCount; level++) {
    images.push(await makeNoiseImage(64 >> level, 32 >> level, level + 1))
  }

  // First call allocates the chain and encodes level 0 only; the rest come one level per call.
  const chain = await spark.encodeTexture(images[0], { ...options, mipmapCount: levelCount })
  assert.equal(chain.mipmapCount, levelCount)
  const level0 = await spark.encodeTexture(images[0], options)
  assert.equal(chain.byteLength, level0.byteLength, "only level 0 should have been written")
  gl.deleteTexture(level0.texture)
  for (let level = 1; level < levelCount; level++) {
    const result = await spark.encodeTexture(images[level], { ...options, outputTexture: chain, outputMipLevel: level })
    assert.equal(result.texture, chain.texture)
  }

  // Every level matches the image encoded on its own.
  for (let level = 0; level < levelCount; level++) {
    const single = await spark.encodeTexture(images[level], options)
    const diff = firstDifference(
      readMipLevel(gl, chain.texture, level, 64 >> level, 32 >> level),
      readMipLevel(gl, single.texture, 0, 64 >> level, 32 >> level)
    )
    assert.ok(!diff, `level ${level}: ${diff}`)
    gl.deleteTexture(single.texture)
  }

  gl.deleteTexture(chain.texture)
  await spark.dispose()
  assert.equal(tracker.live.size, 0, `leaked GL resources: ${tracker.describe()}`)
})

// Upload an image to an RGBA8 texture and describe it as an encodeTexture source.
function uploadTexture(gl, image) {
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, image.width, image.height)
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, image.width, image.height, gl.RGBA, gl.UNSIGNED_BYTE, image)
  gl.bindTexture(gl.TEXTURE_2D, null)
  return { texture, width: image.width, height: image.height }
}

for (const options of [{}, { flipY: true }, { mips: true }, { mips: true, flipY: true }]) {
  test(`SparkGL: a WebGL texture source encodes like the image (${JSON.stringify(options)})`, async () => {
    const tracker = createGL()
    const gl = tracker.gl
    const spark = SparkGL.create(gl)
    const image = await makeNoiseImage(64, 32, 1)
    const input = uploadTexture(gl, image)

    const expected = await spark.encodeTexture(image, { format: "rgb", ...options })
    const actual = await spark.encodeTexture(input, { format: "rgb", ...options })
    assert.equal(actual.mipmapCount, expected.mipmapCount)
    for (let level = 0; level < expected.mipmapCount; level++) {
      const w = Math.max(1, 64 >> level)
      const h = Math.max(1, 32 >> level)
      const diff = firstDifference(readMipLevel(gl, actual.texture, level, w, h), readMipLevel(gl, expected.texture, level, w, h))
      assert.ok(!diff, `level ${level}: ${diff}`)
    }

    gl.deleteTexture(expected.texture)
    gl.deleteTexture(actual.texture)
    gl.deleteTexture(input.texture)
    await spark.dispose()
    assert.equal(tracker.live.size, 0, `leaked GL resources: ${tracker.describe()}`)
  })
}

test("SparkGL: a WebGL texture source encoded in place keeps its state and is not deleted", async () => {
  const tracker = createGL()
  const gl = tracker.gl
  const spark = SparkGL.create(gl, { cacheTempResources: true })
  const image = await makeNoiseImage(64, 32, 1)
  const input = uploadTexture(gl, image)

  gl.bindTexture(gl.TEXTURE_2D, input.texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT)
  gl.bindTexture(gl.TEXTURE_2D, null)

  // Encoding in place allocates no source copy: only the output texture, render target and
  // readback are created.
  const creations = countTextureCreations(gl)
  const first = await spark.encodeTexture(input, { format: "rgb" })
  assert.equal(creations.count, 2, "in-place encode should allocate only the output and the render target")

  gl.bindTexture(gl.TEXTURE_2D, input.texture)
  assert.equal(gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER), gl.LINEAR, "TEXTURE_MIN_FILTER was changed")
  assert.equal(gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S), gl.MIRRORED_REPEAT, "TEXTURE_WRAP_S was changed")
  assert.equal(gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL), 0, "TEXTURE_BASE_LEVEL was changed")
  gl.bindTexture(gl.TEXTURE_2D, null)

  // The input texture is still usable afterwards (it was not deleted by the cleanup).
  const second = await spark.encodeTexture(input, { format: "rgb", outputTexture: first })
  assert.equal(second.texture, first.texture)
  assert.ok(gl.isTexture(input.texture), "input texture was deleted")

  await assert.rejects(spark.encodeTexture({ texture: input.texture, width: 0, height: 32 }, { format: "rgb" }), /positive integer/)

  gl.deleteTexture(first.texture)
  gl.deleteTexture(input.texture)
  await spark.dispose()
  assert.equal(tracker.live.size, 0, `leaked GL resources: ${tracker.describe()}`)
})

test("SparkGL: flipY flips every source type", async () => {
  const tracker = createGL()
  const gl = tracker.gl
  const spark = SparkGL.create(gl)
  const bitmap = await makeNoiseImage(64, 32, 1)

  // Reference: the image flipped on the CPU, encoded without flipY.
  const flippedCanvas = new OffscreenCanvas(64, 32)
  const ctx = flippedCanvas.getContext("2d")
  ctx.translate(0, 32)
  ctx.scale(1, -1)
  ctx.drawImage(bitmap, 0, 0)
  const expected = await spark.encodeTexture(flippedCanvas, { format: "rgb" })
  const expectedPixels = readMipLevel(gl, expected.texture, 0, 64, 32)

  const canvas = new OffscreenCanvas(64, 32)
  canvas.getContext("2d").drawImage(bitmap, 0, 0)
  const sources = {
    ImageBitmap: bitmap,
    OffscreenCanvas: canvas,
    VideoFrame: new VideoFrame(canvas, { timestamp: 0 }),
    WebGLTexture: uploadTexture(gl, bitmap)
  }
  for (const [name, source] of Object.entries(sources)) {
    const result = await spark.encodeTexture(source, { format: "rgb", flipY: true })
    const diff = firstDifference(readMipLevel(gl, result.texture, 0, 64, 32), expectedPixels)
    assert.ok(!diff, `${name}: ${diff}`)
    gl.deleteTexture(result.texture)
  }
  sources.VideoFrame.close()

  gl.deleteTexture(expected.texture)
  gl.deleteTexture(sources.WebGLTexture.texture)
  await spark.dispose()
  assert.equal(tracker.live.size, 0, `leaked GL resources: ${tracker.describe()}`)
})
