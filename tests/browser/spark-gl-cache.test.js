import { SparkGL } from "../../src/index.js"
import { test, assert, skip, isSoftwareGL, makeSolidImage } from "../harness.js"
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

test("SparkGL: cached source texture is reused correctly for a smaller image with mipmaps", async () => {
  const tracker = createGL()
  const gl = tracker.gl
  const spark = SparkGL.create(gl, { cacheTempResources: true })
  const format = "rgb"

  // First encode sizes the cache at 32x32 with 4 mip levels and leaves the source texture dirty.
  const red = await spark.encodeTexture(await makeSolidImage(32, "#ff0000"), { format, generateMipmaps: true })
  assertSolid(readMipLevel(gl, red.texture, 0, 32, 32), [255, 0, 0], "red level 0")
  gl.deleteTexture(red.texture)

  const live = tracker.live.size

  // Second encode must reuse the larger cached source texture: only the new output is added.
  const green = await spark.encodeTexture(await makeSolidImage(16, "#00ff00"), { format, generateMipmaps: true })
  assert.equal(tracker.live.size, live + 1, `source texture was reallocated: ${tracker.describe()}`)
  assert.equal(green.mipmapCount, 3, "unexpected mipmap count")
  assertSolid(readMipLevel(gl, green.texture, 0, 16, 16), [0, 255, 0], "green level 0")
  assertSolid(readMipLevel(gl, green.texture, 1, 8, 8), [0, 255, 0], "green level 1")
  assertSolid(readMipLevel(gl, green.texture, 2, 4, 4), [0, 255, 0], "green level 2")
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

test("SparkGL: minSize allocates once for a sequence of growing encodes", async () => {
  const tracker = createGL()
  const gl = tracker.gl
  const spark = SparkGL.create(gl, { cacheTempResources: { minSize: 512 } })
  const format = "rgb"

  const first = await spark.encodeTexture(await makeSolidImage(64, "#ff0000"), { format })
  gl.deleteTexture(first.texture)

  const created = countTextureCreations(gl)
  for (const size of [128, 256, 512]) {
    const result = await spark.encodeTexture(await makeSolidImage(size, "#00ff00"), { format })
    assertSolid(readMipLevel(gl, result.texture, 0, size, size), [0, 255, 0], `${size} level 0`)
    gl.deleteTexture(result.texture)
  }
  // readMipLevel creates one texture per call; plus one output per encode.
  assert.equal(created.count, 6, `cache was reallocated: ${created.count} textures created`)

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
  const mipped = await spark.encodeTexture(await makeSolidImage(32, "#00ff00"), { format, generateMipmaps: true })
  assert.equal(created.count, 1, "expected only the output texture to be created")
  assertSolid(readMipLevel(gl, mipped.texture, 2, 8, 8), [0, 255, 0], "green level 2")
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
  const mipped = await spark.encodeTexture(await makeSolidImage(32, "#00ff00"), { format, generateMipmaps: true })
  assert.equal(created.count, 2, "expected output texture plus one source reallocation")
  gl.deleteTexture(mipped.texture)

  // The reallocated chain is sized for minSize, so a mipmapped 64x64 reuses it.
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
