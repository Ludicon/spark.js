import { SparkGL } from "../../src/index.js"
import { test, assert, skip, isSoftwareGL } from "../harness.js"
import { trackGL } from "../gl-tracker.js"

function createGL() {
  const gl = new OffscreenCanvas(4, 4).getContext("webgl2")
  if (!gl) skip("WebGL2 not available")
  if (isSoftwareGL(gl)) skip("compressed mip levels are not reliable on software GL")
  return trackGL(gl)
}

async function makeSolidImage(size, color) {
  const canvas = new OffscreenCanvas(size, size)
  const ctx = canvas.getContext("2d")
  ctx.fillStyle = color
  ctx.fillRect(0, 0, size, size)
  return createImageBitmap(canvas)
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
  const format = spark.getSupportedFormats()[0]

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
  const format = spark.getSupportedFormats()[0]

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
