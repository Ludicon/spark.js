// WebGL implementation of spark.js texture compression API
import glslShaders from "./shaders/glsl-shaders.js"
import { assert, loadImage, loadImageFromBlob } from "./utils.js"

const SparkFormat = {
  ASTC_4x4_RGB: 0,
  ASTC_4x4_RGBA: 1,
  EAC_R: 4,
  EAC_RG: 5,
  ETC2_RGB: 6,
  BC1_RGB: 9,
  BC4_R: 13,
  BC5_RG: 14,
  BC7_RGB: 16,
  BC7_RGBA: 17
}

const SparkFormatName = [
  /* 0  */ "astc-4x4-rgb",
  /* 1  */ "astc-4x4-rgba",
  /* 2  */ null,
  /* 3  */ null,
  /* 4  */ "eac-r",
  /* 5  */ "eac-rg",
  /* 6  */ "etc2-rgb",
  /* 7  */ null,
  /* 8  */ null,
  /* 9  */ "bc1-rgb",
  /* 10 */ null,
  /* 11 */ null,
  /* 12 */ null,
  /* 13 */ "bc4-r",
  /* 14 */ "bc5-rg",
  /* 15 */ null,
  /* 16 */ "bc7-rgb",
  /* 17 */ "bc7-rgba"
]

const SparkShaderFiles = [
  /* 0  */ "spark_astc_rgb.glsl",
  /* 1  */ "spark_astc_rgba.glsl",
  /* 2  */ null,
  /* 3  */ null,
  /* 4  */ "spark_eac_r.glsl",
  /* 5  */ "spark_eac_rg.glsl",
  /* 6  */ "spark_etc2_rgb.glsl",
  /* 7  */ null,
  /* 8  */ null,
  /* 9  */ "spark_bc1_rgb.glsl",
  /* 10 */ null,
  /* 11 */ null,
  /* 12 */ null,
  /* 13 */ "spark_bc4_r.glsl",
  /* 14 */ "spark_bc5_rg.glsl",
  /* 15 */ null,
  /* 16 */ "spark_bc7_rgb.glsl",
  /* 17 */ "spark_bc7_rgba.glsl"
]

// prettier-ignore
const SparkBlockSize = [
  /* 0  */ 16,
  /* 1  */ 16,
  /* 2  */ 0,
  /* 3  */ 0,
  /* 4  */ 8,
  /* 5  */ 16,
  /* 6  */ 8,
  /* 7  */ 0,
  /* 8  */ 0,
  /* 9  */ 8,
  /* 10 */ 0,
  /* 11 */ 0,
  /* 12 */ 0,
  /* 13 */ 8,
  /* 14 */ 16,
  /* 15 */ 0,
  /* 16 */ 16,
  /* 17 */ 16
]

const SparkFormatIsRGB = [
  /* 0  */ true, // ASTC_4x4_RGB
  /* 1  */ true, // ASTC_4x4_RGBA
  /* 2  */ null,
  /* 3  */ null,
  /* 4  */ false, // EAC_R
  /* 5  */ false, // EAC_RG
  /* 6  */ true, // ETC2_RGB
  /* 7  */ null,
  /* 8  */ null,
  /* 9  */ true, // BC1_RGB
  /* 10 */ null,
  /* 11 */ null,
  /* 12 */ null,
  /* 13 */ false, // BC4_R
  /* 14 */ false, // BC5_RG
  /* 15 */ null,
  /* 16 */ true, // BC7_RGB
  /* 17 */ true // BC7_RGBA
]

// GL format constants
const GL_COMPRESSED_RGBA_ASTC_4x4_KHR = 0x93b0
const GL_COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR = 0x93d0
const GL_COMPRESSED_RGBA_BPTC_UNORM = 0x8e8c
const GL_COMPRESSED_SRGB_ALPHA_BPTC_UNORM = 0x8e8d
const GL_COMPRESSED_RGB_S3TC_DXT1_EXT = 0x83f0
const GL_COMPRESSED_SRGB_S3TC_DXT1_EXT = 0x8c4c
const GL_COMPRESSED_RED_RGTC1 = 0x8dbb
const GL_COMPRESSED_RG_RGTC2 = 0x8dbd
const GL_COMPRESSED_RGB8_ETC2 = 0x9274
const GL_COMPRESSED_SRGB8_ETC2 = 0x9275
const GL_COMPRESSED_R11_EAC = 0x9270
const GL_COMPRESSED_RG11_EAC = 0x9272

// GL internal format for render targets
const GL_RGBA32UI = 0x8d70
const GL_RGBA16UI = 0x8d76

const SparkGLFormats = [
  /* 0  */ [GL_COMPRESSED_RGBA_ASTC_4x4_KHR, GL_COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR],
  /* 1  */ [GL_COMPRESSED_RGBA_ASTC_4x4_KHR, GL_COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR],
  /* 2  */ null,
  /* 3  */ null,
  /* 4  */ [GL_COMPRESSED_R11_EAC, GL_COMPRESSED_R11_EAC],
  /* 5  */ [GL_COMPRESSED_RG11_EAC, GL_COMPRESSED_RG11_EAC],
  /* 6  */ [GL_COMPRESSED_RGB8_ETC2, GL_COMPRESSED_SRGB8_ETC2],
  /* 7  */ null,
  /* 8  */ null,
  /* 9  */ [GL_COMPRESSED_RGB_S3TC_DXT1_EXT, GL_COMPRESSED_SRGB_S3TC_DXT1_EXT],
  /* 10 */ null,
  /* 11 */ null,
  /* 12 */ null,
  /* 13 */ [GL_COMPRESSED_RED_RGTC1, GL_COMPRESSED_RED_RGTC1],
  /* 14 */ [GL_COMPRESSED_RG_RGTC2, GL_COMPRESSED_RG_RGTC2],
  /* 15 */ null,
  /* 16 */ [GL_COMPRESSED_RGBA_BPTC_UNORM, GL_COMPRESSED_SRGB_ALPHA_BPTC_UNORM],
  /* 17 */ [GL_COMPRESSED_RGBA_BPTC_UNORM, GL_COMPRESSED_SRGB_ALPHA_BPTC_UNORM]
]

const SparkGLUintFormats = [
  /* 0  */ GL_RGBA32UI,
  /* 1  */ GL_RGBA32UI,
  /* 2  */ null,
  /* 3  */ null,
  /* 4  */ GL_RGBA16UI,
  /* 5  */ GL_RGBA32UI,
  /* 6  */ GL_RGBA16UI,
  /* 7  */ null,
  /* 8  */ null,
  /* 9  */ GL_RGBA16UI,
  /* 10 */ null,
  /* 11 */ null,
  /* 12 */ null,
  /* 13 */ GL_RGBA16UI,
  /* 14 */ GL_RGBA32UI,
  /* 15 */ null,
  /* 16 */ GL_RGBA32UI,
  /* 17 */ GL_RGBA32UI
]

const SparkFormatMap = Object.freeze({
  "astc-4x4-rgb": SparkFormat.ASTC_4x4_RGB,
  "astc-4x4-rgba": SparkFormat.ASTC_4x4_RGBA,
  "eac-r": SparkFormat.EAC_R,
  "eac-rg": SparkFormat.EAC_RG,
  "etc2-rgb": SparkFormat.ETC2_RGB,
  "bc1-rgb": SparkFormat.BC1_RGB,
  "bc4-r": SparkFormat.BC4_R,
  "bc5-rg": SparkFormat.BC5_RG,
  "bc7-rgb": SparkFormat.BC7_RGB,
  "bc7-rgba": SparkFormat.BC7_RGBA,
  "astc-rgb": SparkFormat.ASTC_4x4_RGB,
  "astc-rgba": SparkFormat.ASTC_4x4_RGBA
})

function detectWebGLFormats(gl, verbose = false) {
  const supportedFormats = new Set()

  // Debug: Print all available extensions
  if (verbose) {
    const availableExtensions = gl.getSupportedExtensions()
    console.log("Available WebGL extensions:")
    if (availableExtensions) {
      availableExtensions.sort().forEach(ext => {
        console.log(`  ${ext}`)
      })
    }
    console.log(`Total: ${availableExtensions ? availableExtensions.length : 0} extensions`)
    console.log("")
  }

  // Check for BC (desktop) formats
  const bcExt = gl.getExtension("EXT_texture_compression_bptc") || gl.getExtension("WEBGL_texture_compression_bptc")
  if (bcExt) {
    supportedFormats.add(SparkFormat.BC7_RGB)
    supportedFormats.add(SparkFormat.BC7_RGBA)
  }

  const s3tcExt = gl.getExtension("WEBGL_compressed_texture_s3tc")
  const s3tcSrgbExt = gl.getExtension("WEBGL_compressed_texture_s3tc_srgb")
  if (s3tcExt || s3tcSrgbExt) {
    supportedFormats.add(SparkFormat.BC1_RGB)
  }

  const rgtcExt = gl.getExtension("EXT_texture_compression_rgtc")
  if (rgtcExt) {
    supportedFormats.add(SparkFormat.BC4_R)
    supportedFormats.add(SparkFormat.BC5_RG)
  }

  // Check for ETC2 (mobile) formats
  const etc2Ext = gl.getExtension("WEBGL_compressed_texture_etc")
  if (etc2Ext) {
    supportedFormats.add(SparkFormat.ETC2_RGB)
    supportedFormats.add(SparkFormat.EAC_R)
    supportedFormats.add(SparkFormat.EAC_RG)
  }

  // Check for ASTC formats
  const astcExt = gl.getExtension("WEBGL_compressed_texture_astc")
  if (astcExt) {
    supportedFormats.add(SparkFormat.ASTC_4x4_RGB)
    supportedFormats.add(SparkFormat.ASTC_4x4_RGBA)
  }

  if (verbose) {
    console.log("Supported compression formats:")
    const formatNames = Array.from(supportedFormats)
      .map(format => SparkFormatName[format])
      .filter(Boolean)
    formatNames.forEach(name => {
      console.log(`  ${name}`)
    })
    console.log(`Total: ${formatNames.length} formats`)
    console.log("")
  }

  return supportedFormats
}

async function loadShaderSource(shaderFile) {
  const loader = glslShaders[shaderFile]
  if (!loader) {
    throw new Error(`Shader not found: ${shaderFile}`)
  }
  let shaderCode = await loader()

  // Add GLSL ES 3.00 header with precision qualifiers
  const prefix = `#version 300 es
precision highp float;
precision highp int;
`
  shaderCode = prefix + shaderCode

  return shaderCode
}

const VERTEX_SHADER_SOURCE = `#version 300 es
void main() {
    vec2 uv = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
}
`

function createShader(gl, type, source, validate) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (validate && !gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compilation failed: ${info}`)
  }

  return shader
}

function createProgram(gl, vertexShader, fragmentShader, validate) {
  const program = gl.createProgram()
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  if (validate && !gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`Program linking failed: ${info}`)
  }

  return program
}

export class SparkGL {
  #gl
  #supportedFormats
  #programs = []
  #verbose = false
  #validateShaders = false
  #encodeCounter = 0
  #fullscreenVertexShader
  #cacheTempResources = false
  // Cached temporary resources for encodeTexture
  #cachedBuffer = null
  #cachedBufferSize = 0
  /**
   * Free source copies, keyed by exact shape ("WxH"). See #acquireSrcTexture.
   *
   * Separate from the #cachedTexture8/16 pair below because it answers a different question.
   * Those are ONE render target that grows to fit the largest encode; this is a set, because
   * a caller encoding a 4096 and a 256 needs both shapes and neither can stand in for the
   * other — the encode reads the source with texelFetch at its own dimensions.
   */
  #srcPool = new Map()
  #srcServed = 0
  #srcAllocated = 0
  #cachedTexture8 = null // For 8-byte per block formats
  #cachedTexture8Width = 0
  #cachedTexture8Height = 0
  #cachedTexture16 = null // For 16-byte per block formats
  #cachedTexture16Width = 0
  #cachedTexture16Height = 0
  // Block-grid side for the cached render target's first allocation, from
  // options.hintMaxTmpCacheResolution. 0 = size it to the first encode and grow.
  #maxCacheBlocks = 0
  #cachedFbo = null

  constructor(gl, options = {}) {
    if (!gl) {
      throw new Error("WebGL2 context is required")
    }
    this.#gl = gl
    this.#verbose = options.verbose ?? false
    this.#validateShaders = options.validateShaders ?? false
    this.#cacheTempResources = options.cacheTempResources ?? false
    // In TEXELS at the API boundary -- that is the number a caller knows about its own images
    // -- converted once to the block grid the render target is actually measured in.
    this.setHintMaxTmpCacheResolution(options.hintMaxTmpCacheResolution ?? 0)
    this.#supportedFormats = detectWebGLFormats(gl, this.#verbose)

    // Handle preload option
    if (options.preload) {
      this.#preloadShaders(options.preload)
    }
  }
  dispose() {
    const gl = this.#gl

    // Scratch first, and unconditionally: #programs holds PROMISES (see #loadProgram), so
    // the loop below used to hand a Promise to gl.deleteProgram and throw before ever
    // reaching this call -- leaving the buffer, render target and FBO alive for the lifetime
    // of the context.
    this.freeTempResources()

    if (this.#fullscreenVertexShader) {
      gl.deleteShader(this.#fullscreenVertexShader)
    }
    for (const entry of this.#programs) {
      if (!entry) continue
      // A program may still be compiling. Resolve first, and swallow a rejected load: a
      // shader that failed to compile has nothing to delete, and dispose() must not be the
      // place that surfaces it.
      Promise.resolve(entry).then(
        (program) => { if (program) gl.deleteProgram(program) },
        () => {},
      )
    }
    this.#programs = []
  }

  /**
   * Take a source-copy texture of this shape from the pool, or make one.
   *
   * The source copy is a full RGBA8 mip chain of the image being encoded -- 85 MB for a 4096
   * -- and it was created and deleted on every call. cacheTempResources reaches the block
   * render target, the PBO and the FBO, but not this, the largest of the four.
   *
   * Keyed on the shape, and a pooled texture is never resized: its storage is IMMUTABLE
   * (texStorage2D), so a second texStorage2D on it is INVALID_OPERATION and a silent no-op --
   * the texture would keep its first shape and the encode proceed against the wrong one.
   *
   * That is also why the caller must SKIP texStorage2D for a pooled texture rather than let
   * it no-op harmlessly: even when the shape matches, the call still raises
   * INVALID_OPERATION into the context's single shared error queue, once per pool hit.
   * Whoever reads gl.getError() next inherits it and blames their own last call.
   *
   * The copy is ALWAYS allocated with a full mip chain, whatever this encode's mipmapCount
   * is, and that is what lets the key be the shape alone -- mipmapCount follows
   * options.generateMipmaps rather than the dimensions, so the same WxH can be asked for with
   * eleven levels or with one. Putting the count in the key would work too, but it makes the
   * key depend on a per-call flag. The chain costs 4/3 of level 0 on encodes that did not ask
   * for mips, and buys a key that cannot move.
   *
   * At most one texture is retained per shape. freeTempResources() drops them all.
   */
  #acquireSrcTexture(width, height) {
    const gl = this.#gl
    if (this.#cacheTempResources) {
      const free = this.#srcPool.get(`${width}x${height}`)
      if (free && free.length > 0) {
        this.#srcServed++
        const texture = free.pop()
        // Hand back a texture in the state a FRESH one would be in.
        //
        // TEXTURE_BASE_LEVEL is the one parameter the encode loop dirties and nobody
        // repairs: it is set to the level being encoded and left at the last one. A freshly
        // created texture starts at 0, which is why nothing here ever had to set it --
        // pooling is what breaks that assumption. Left at 10, the next generateMipmap
        // sources from level 10 and derives nothing below it, so levels 1..9 keep the
        // PREVIOUS image's content. Clearing them would not help: they are regenerated, but
        // only from BASE_LEVEL up.
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, 0)
        return { texture, pooled: true }
      }
    }
    this.#srcAllocated++
    return { texture: gl.createTexture(), pooled: false }
  }

  /**
   * Restate the hint after construction, for a session that outlives what it encodes: it
   * knows the DEVICE's limits when it is built and the CONTENT's only later, and sizing from
   * the device cap is the expensive mistake.
   *
   * Applies the next time the target is allocated or grown, which is soon enough -- the
   * target is lazy. Deliberately does not reallocate an existing one: an encode may be
   * reading it.
   *
   * @param {number} resolution - Largest texture to be encoded, in texels. 0 = grow to fit.
   */
  setHintMaxTmpCacheResolution(resolution) {
    if (resolution > 0 && !Number.isFinite(resolution)) {
      throw new Error(`hintMaxTmpCacheResolution must be a finite number of texels, got ${resolution}`)
    }
    this.#maxCacheBlocks = resolution > 0 ? Math.ceil(resolution / 4) : 0
  }

  /** Return a source copy to the pool, or delete it when pooling is off. */
  #releaseSrcTexture(texture, width, height) {
    if (!this.#cacheTempResources) {
      this.#gl.deleteTexture(texture)
      return
    }
    const key = `${width}x${height}`
    let free = this.#srcPool.get(key)
    if (!free) {
      free = []
      this.#srcPool.set(key, free)
    }
    // One per shape. encodeTexture holds exactly one source copy at a time, so a second is
    // only ever reachable through concurrent calls -- and retaining an 85 MB texture on the
    // chance of an overlap is the wrong trade for the thing this pool exists to reduce.
    if (free.length >= 1) {
      this.#gl.deleteTexture(texture)
      return
    }
    free.push(texture)
  }

  /**
   * How the source-copy pool is doing: `served` from the pool, `allocated` fresh, and the
   * shapes currently retained.
   *
   * Worth exposing rather than keeping internal: a pool that is keyed wrongly still reports
   * a high hit rate while handing back textures of the wrong shape, and served-vs-shapes is
   * what makes that visible from outside.
   */
  getTempResourceStats() {
    return {
      srcServed: this.#srcServed,
      srcAllocated: this.#srcAllocated,
      srcShapes: [...this.#srcPool.entries()].map(([key, free]) => ({ key, retained: free.length })),
    }
  }

  /**
   * Initialize the encoder by detecting available compression formats.
   * @param {WebGL2RenderingContext} gl - WebGL2 context.
   * @param {Object} options - Encoder options.
   * @param {boolean|string[]} options.preload - Whether to preload all encoder pipelines, or an array of format names to preload (false by default).
   * @param {boolean} options.verbose - Whether to enable verbose logging (false by default).
   * @param {boolean} options.cacheTempResources - Whether to cache temporary resources for reuse across encodeTexture calls (false by default).
   * @param {number} options.hintMaxTmpCacheResolution - HINT: the largest texture this session expects to encode, in texels. The cached render target is allocated at that size on its first use instead of growing to fit, which removes the reallocation a small-then-large sequence would otherwise cause. It is not a limit -- an encode larger than the hint still grows the target rather than failing. Only meaningful with cacheTempResources.
   * @returns {SparkGL} A new SparkGL instance.
   */
  static create(gl, options = {}) {
    return new SparkGL(gl, options)
  }

  #log(...args) {
    if (this.#verbose) {
      console.log(...args)
    }
  }

  #time(label) {
    if (this.#verbose) {
      console.time(label)
    }
  }

  #timeEnd(label) {
    if (this.#verbose) {
      console.timeEnd(label)
    }
  }

  async #preloadShaders(preload) {
    let formatsToLoad
    if (Array.isArray(preload)) {
      formatsToLoad = preload.map(n => this.#getPreferredFormat(n, false))
    } else {
      formatsToLoad = this.#supportedFormats
    }

    // Kick off parallel compilation
    for (const format of formatsToLoad) {
      if (format !== undefined && !this.#programs[format]) {
        // Don't await and or validate. Let them load and compile in the background.
        this.#loadProgram(format).catch(err => {
          console.error(`Failed to preload program for format ${SparkFormatName[format]}:`, err)
        })
      }
    }
  }

  getSupportedFormats() {
    return Array.from(this.#supportedFormats)
      .map(format => SparkFormatName[format])
      .filter(Boolean)
  }

  isFormatSupported(format) {
    const sparkFormat = typeof format === "string" ? SparkFormatMap[format] : format
    return this.#supportedFormats.has(sparkFormat)
  }

  /**
   * Free cached temporary resources used by encodeTexture.
   * Call this when you're done encoding textures to free up GPU memory.
   */
  freeTempResources() {
    const gl = this.#gl

    if (this.#cachedBuffer) {
      gl.deleteBuffer(this.#cachedBuffer)
      this.#cachedBuffer = null
      this.#cachedBufferSize = 0
    }

    if (this.#cachedTexture8) {
      gl.deleteTexture(this.#cachedTexture8)
      this.#cachedTexture8 = null
      this.#cachedTexture8Width = 0
      this.#cachedTexture8Height = 0
    }

    if (this.#cachedTexture16) {
      gl.deleteTexture(this.#cachedTexture16)
      this.#cachedTexture16 = null
      this.#cachedTexture16Width = 0
      this.#cachedTexture16Height = 0
    }

    if (this.#cachedFbo) {
      gl.deleteFramebuffer(this.#cachedFbo)
      this.#cachedFbo = null
    }

    for (const free of this.#srcPool.values()) {
      for (const texture of free) gl.deleteTexture(texture)
    }
    this.#srcPool.clear()
  }

  /**
   * Levels a complete chain has for this size, down to a 4x4 tail.
   *
   * One definition, used by the encode AND by the source copy, which no longer agree by
   * accident: the copy is always allocated with the full chain (see #acquireSrcTexture) while
   * the encode may be asked for a single level.
   */
  static #fullMipCount(width, height) {
    const MIN_MIP_SIZE = 4
    let count = 1
    let w = width
    let h = height
    while (w > MIN_MIP_SIZE || h > MIN_MIP_SIZE) {
      count++
      w = Math.max(1, Math.floor(w / 2))
      h = Math.max(1, Math.floor(h / 2))
    }
    return count
  }

  #isFormatSupported(format) {
    return this.#supportedFormats.has(format)
  }

  #getPreferredFormat(format, preferLowQuality = false) {
    // First check if the format is an explicit format.
    const explicitFormat = SparkFormatMap[format]
    if (explicitFormat != undefined && this.#isFormatSupported(explicitFormat)) {
      return explicitFormat
    }

    // Otherwise, try to match it based on the preferenceOrder. Formats are sorted by number of channel and quality.
    const preferenceOrder = preferLowQuality
      ? ["bc4-r", "eac-r", "bc5-rg", "eac-rg", "bc1-rgb", "etc2-rgb", "bc7-rgb", "astc-rgb", "astc-4x4-rgb", "bc7-rgba", "astc-rgba", "astc-4x4-rgba"]
      : ["bc4-r", "eac-r", "bc5-rg", "eac-rg", "bc7-rgb", "astc-rgb", "astc-4x4-rgb", "bc1-rgb", "etc2-rgb", "bc7-rgba", "astc-rgba", "astc-4x4-rgba"]

    // This allows selecting the best format using a substring like "rgb" or "astc"
    for (const key of preferenceOrder) {
      if (key.includes(format) && this.#isFormatSupported(SparkFormatMap[key])) {
        return SparkFormatMap[key]
      }
    }

    return undefined
  }

  #loadProgram(format) {
    if (this.#programs[format]) {
      return this.#programs[format]
    }

    const programPromise = (async () => {
      const message = "Loading program for format: " + SparkFormatName[format]
      this.#time(message)

      const gl = this.#gl
      const shaderFile = SparkShaderFiles[format]

      if (!this.#fullscreenVertexShader) {
        this.#fullscreenVertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE, this.#validateShaders)
      }

      const fragmentShaderSource = await loadShaderSource(shaderFile)

      const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource, this.#validateShaders)
      const program = createProgram(gl, this.#fullscreenVertexShader, fragmentShader, this.#validateShaders)
      gl.deleteShader(fragmentShader)

      this.#timeEnd(message)

      return program
    })()

    this.#programs[format] = programPromise
    return programPromise
  }

  async encodeTexture(image, options = {}) {
    const gl = this.#gl

    // Decode raw byte sources (URLs, Blobs) and recurse so we can close the resulting image
    // (loadImage / loadImageFromBlob may return a VideoFrame on Firefox).
    if (typeof image === "string" || image instanceof Blob) {
      const loaded = image instanceof Blob ? await loadImageFromBlob(image) : await loadImage(image)
      try {
        return await this.encodeTexture(loaded, options)
      } finally {
        loaded.close?.()
      }
    }

    // Diagnose image type
    this.#log(`Image type: ${image.constructor.name}`)

    const width = image.displayWidth ?? image.width ?? image.videoWidth
    const height = image.displayHeight ?? image.height ?? image.videoHeight
    assert(width && height)

    // Choose format. Default to "rgb" if no format specified
    const formatOption = options.format ?? "rgb"

    let format
    if (typeof formatOption === "string") {
      format = this.#getPreferredFormat(formatOption, options.preferLowQuality)
      if (format === undefined) {
        throw new Error(`Unsupported format: ${formatOption}`)
      }
    } else {
      // Numeric format directly specified
      format = formatOption
      if (!this.#supportedFormats.has(format)) {
        throw new Error(`Format not supported: ${SparkFormatName[format]}`)
      }
    }

    // Load and compile shader program
    const program = await this.#loadProgram(format)

    this.#log(`Selected format: ${SparkFormatName[format]}`)

    const blockSize = SparkBlockSize[format]

    // Determine if we should use sRGB format
    const srgb = (options.srgb || options.format?.endsWith("srgb")) && SparkFormatIsRGB[format]
    const glFormatPair = SparkGLFormats[format]
    const glFormat = glFormatPair ? (srgb ? glFormatPair[1] : glFormatPair[0]) : null
    const glUintFormat = SparkGLUintFormats[format]

    this.#log(`Using ${srgb ? "sRGB" : "linear"} color space`)

    // Make sure we don't have any async code after this, otherwise timing will be incorrect
    // and state restoration will fail.
    const timingLabel = `encodeTexture #${++this.#encodeCounter}`
    this.#time(timingLabel)

    // Save GL state at the very beginning to restore later (to avoid interfering with three.js or other renderers)
    const savedState = {
      program: gl.getParameter(gl.CURRENT_PROGRAM),
      activeTexture: gl.getParameter(gl.ACTIVE_TEXTURE),
      textureBinding: gl.getParameter(gl.TEXTURE_BINDING_2D),
      framebuffer: gl.getParameter(gl.FRAMEBUFFER_BINDING),
      readFramebuffer: gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),
      viewport: gl.getParameter(gl.VIEWPORT),
      blend: gl.getParameter(gl.BLEND),
      depthTest: gl.getParameter(gl.DEPTH_TEST),
      stencilTest: gl.getParameter(gl.STENCIL_TEST),
      cullFace: gl.getParameter(gl.CULL_FACE),
      scissorTest: gl.getParameter(gl.SCISSOR_TEST),
      pixelPackBuffer: gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING),
      pixelUnpackBuffer: gl.getParameter(gl.PIXEL_UNPACK_BUFFER_BINDING),
      arrayBuffer: gl.getParameter(gl.ARRAY_BUFFER_BINDING),
      vertexArray: gl.getParameter(gl.VERTEX_ARRAY_BINDING)
    }

    gl.activeTexture(gl.TEXTURE0)
    gl.disable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.STENCIL_TEST)
    gl.disable(gl.CULL_FACE)
    gl.disable(gl.SCISSOR_TEST)

    // Determine wrap mode
    const wrapMode = options.wrap || "repeat"
    let glWrapMode
    switch (wrapMode) {
      case "repeat":
        glWrapMode = gl.REPEAT
        break
      case "mirror":
        glWrapMode = gl.MIRRORED_REPEAT
        break
      case "clamp":
      default:
        glWrapMode = gl.CLAMP_TO_EDGE
        break
    }

    // Determine mipmap count
    const generateMipmaps = options.generateMipmaps || options.mips
    const mipmapCount = generateMipmaps ? SparkGL.#fullMipCount(width, height) : 1

    // Create input texture (pooled by shape -- see #acquireSrcTexture)
    const { texture: srcTexture, pooled: srcPooled } = this.#acquireSrcTexture(width, height)
    gl.bindTexture(gl.TEXTURE_2D, srcTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, glWrapMode)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, glWrapMode)

    // The FULL chain, not this encode's mipmapCount -- see #acquireSrcTexture for why the
    // level count is deliberately not part of the pool key.
    //
    // A pooled texture already has exactly this storage -- the pool is keyed on the shape,
    // never resizes, and every entry was allocated with the same rule -- and storage is
    // immutable, so asking again is INVALID_OPERATION and a no-op. Harmless to the pixels,
    // not harmless to the error queue: see #acquireSrcTexture.
    if (!srcPooled) {
      gl.texStorage2D(gl.TEXTURE_2D, SparkGL.#fullMipCount(width, height), gl.RGBA8, width, height)
    }
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, image)


    // This kind of sucks. We need to flip the texture vertically manually because not all
    // image loading code paths support flipping, and UNPACK_FLIP_Y_WEBGL does not appear to work.
    // I think the problem is that it's emulated with shader changes, but we sample the texture
    // with textureFetch, which appears to bypass that.

    // gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, options.flipY)

    // If we end up using the code below, let's move the program creation to #init.

    let encodeSrcTexture = srcTexture
    if (options.flipY) {
      this.#log("Flipping texture vertically")

      // Create intermediate texture
      const flippedTexture = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, flippedTexture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, glWrapMode)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, glWrapMode)
      gl.texStorage2D(gl.TEXTURE_2D, mipmapCount, gl.RGBA8, width, height)

      // Create temporary FBO for flipping
      const flipFbo = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, flipFbo)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, flippedTexture, 0)

      if (!this.#fullscreenVertexShader) {
        this.#fullscreenVertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE, this.#validateShaders)
      }

      // Simple blit shader to flip the texture using texelFetch
      const flipFs = `#version 300 es
        precision mediump float;
        uniform sampler2D uTexture;
        uniform ivec2 uTextureSize;
        out vec4 fragColor;
        void main() {
          ivec2 coord = ivec2(gl_FragCoord.xy);
          // Flip Y coordinate
          coord.y = uTextureSize.y - 1 - coord.y;
          fragColor = texelFetch(uTexture, coord, 0);
        }`

      const vsShader = gl.createShader(gl.VERTEX_SHADER)
      gl.shaderSource(vsShader, VERTEX_SHADER_SOURCE)
      gl.compileShader(vsShader)

      const fsShader = gl.createShader(gl.FRAGMENT_SHADER)
      gl.shaderSource(fsShader, flipFs)
      gl.compileShader(fsShader)

      const flipProgram = createProgram(gl, vsShader, fsShader, this.#validateShaders)

      // Render flipped texture
      gl.useProgram(flipProgram)
      gl.viewport(0, 0, width, height)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, srcTexture)
      gl.uniform1i(gl.getUniformLocation(flipProgram, "uTexture"), 0)
      gl.uniform2i(gl.getUniformLocation(flipProgram, "uTextureSize"), width, height)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      // Cleanup blit resources
      gl.deleteShader(vsShader)
      gl.deleteShader(fsShader)
      gl.deleteProgram(flipProgram)
      gl.deleteFramebuffer(flipFbo)
      this.#releaseSrcTexture(srcTexture, width, height)

      encodeSrcTexture = flippedTexture
    }

    // Generate mipmaps if requested
    if (generateMipmaps) {
      gl.bindTexture(gl.TEXTURE_2D, encodeSrcTexture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      gl.generateMipmap(gl.TEXTURE_2D)
      this.#log(`Generated ${mipmapCount} mipmap levels`)
    }

    // Create or reuse output compressed texture. The caller can pass a previous
    // encodeTexture() result object as options.outputTexture; it is reused only when
    // dimensions, format, and mipmap count match.
    //
    // options.outputBaseLevel lets that texture be LARGER than this encode: the result is
    // written starting at that level of the caller's pyramid instead of at level 0, so a
    // caller filling one pyramid in several passes can reuse it from the first, small pass
    // instead of having spark allocate a whole pyramid it throws away.
    const outputBaseLevel = options.outputBaseLevel | 0
    const reuseOutput = Boolean(
      options.outputTexture &&
      options.outputTexture.format === glFormat &&
      options.outputTexture.width === width << outputBaseLevel &&
      options.outputTexture.height === height << outputBaseLevel &&
      options.outputTexture.mipmapCount >= mipmapCount + outputBaseLevel
    )
    if (options.outputTexture && !reuseOutput && outputBaseLevel !== 0) {
      throw new Error(
        `outputBaseLevel ${outputBaseLevel} needs an outputTexture of ` +
        `${width << outputBaseLevel}x${height << outputBaseLevel} with at least ` +
        `${mipmapCount + outputBaseLevel} levels in format 0x${glFormat.toString(16)}; got ` +
        `${options.outputTexture.width}x${options.outputTexture.height} with ` +
        `${options.outputTexture.mipmapCount} levels in format 0x${(options.outputTexture.format | 0).toString(16)}`
      )
    }

    const compressedTexture = reuseOutput ? options.outputTexture.texture : gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, compressedTexture)
    if (!reuseOutput) {
      gl.texStorage2D(gl.TEXTURE_2D, mipmapCount, glFormat, width, height)
    }

    // Sampler state belongs to whoever owns the texture. When the caller supplied it, spark
    // has already declined to allocate its storage; overwriting its filters and wrap modes
    // would be the same trespass. A caller reusing its own texture has usually set both from
    // the source material, and a progressive loader drives TEXTURE_BASE_LEVEL / MIN_LOD on
    // it between passes -- resetting those mid-stream is visible on screen.
    if (!reuseOutput) {
      // Set texture filtering parameters
      if (generateMipmaps) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      }

      // Set texture wrapping mode (as determined above)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, glWrapMode)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, glWrapMode)
    }

    const bw = Math.ceil(width / 4)
    const bh = Math.ceil(height / 4)
    const dstBufferSize = blockSize * bw * bh
    let byteLength = dstBufferSize

    const cacheTempResources = this.#cacheTempResources

    // Create or reuse temporary buffer.
    let dstBuffer
    if (cacheTempResources && this.#cachedBuffer && this.#cachedBufferSize >= dstBufferSize) {
      dstBuffer = this.#cachedBuffer
    } else {
      if (cacheTempResources && this.#cachedBuffer) {
        gl.deleteBuffer(this.#cachedBuffer)
      }
      dstBuffer = gl.createBuffer()
      if (cacheTempResources) {
        this.#cachedBuffer = dstBuffer
        this.#cachedBufferSize = dstBufferSize
      }
    }
    // We bind it to PIXEL_PACK_BUFFER to copy the render target into it.
    // We bind it to PIXEL_UNPACK_BUFFER to copy the contents to the compressed texture.
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, dstBuffer)
    gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, dstBuffer)

    // @@ Can we skip this call?
    gl.bufferData(gl.PIXEL_PACK_BUFFER, dstBufferSize, gl.STREAM_COPY)

    // Create or reuse render target (uint) texture.
    // Need different textures for 8-byte and 16-byte per block formats.
    //
    // allocW/allocH honour the size hint: with one declared, the target is allocated at that
    // size the first time instead of growing into it over several encodes.
    const allocW = cacheTempResources ? Math.max(bw, this.#maxCacheBlocks) : bw
    const allocH = cacheTempResources ? Math.max(bh, this.#maxCacheBlocks) : bh
    let mipDstTexture

    if (blockSize === 8) {
      const needsRealloc = !cacheTempResources || this.#cachedTexture8Width < bw || this.#cachedTexture8Height < bh

      if (cacheTempResources && this.#cachedTexture8 && !needsRealloc) {
        mipDstTexture = this.#cachedTexture8
      } else {
        if (cacheTempResources && this.#cachedTexture8) {
          gl.deleteTexture(this.#cachedTexture8)
        }
        mipDstTexture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, mipDstTexture)
        gl.texStorage2D(gl.TEXTURE_2D, 1, glUintFormat, allocW, allocH)
        if (cacheTempResources) {
          this.#cachedTexture8 = mipDstTexture
          this.#cachedTexture8Width = allocW
          this.#cachedTexture8Height = allocH
        }
      }
    } else {
      const needsRealloc = !cacheTempResources || this.#cachedTexture16Width < bw || this.#cachedTexture16Height < bh

      if (cacheTempResources && this.#cachedTexture16 && !needsRealloc) {
        mipDstTexture = this.#cachedTexture16
      } else {
        if (cacheTempResources && this.#cachedTexture16) {
          gl.deleteTexture(this.#cachedTexture16)
        }
        mipDstTexture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, mipDstTexture)
        gl.texStorage2D(gl.TEXTURE_2D, 1, glUintFormat, allocW, allocH)
        if (cacheTempResources) {
          this.#cachedTexture16 = mipDstTexture
          this.#cachedTexture16Width = allocW
          this.#cachedTexture16Height = allocH
        }
      }
    }

    // @@ Not sure it's worth caching the FBO instead of recreating it. We have to bind the
    // dst texture to it and that may change depending on the format.
    // Create or reuse FBO and bind render target texture.
    let fbo
    if (cacheTempResources && this.#cachedFbo) {
      fbo = this.#cachedFbo
    } else {
      fbo = gl.createFramebuffer()
      if (cacheTempResources) {
        this.#cachedFbo = fbo
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.readBuffer(gl.COLOR_ATTACHMENT0)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, mipDstTexture, 0)

    // Setup rendering state
    gl.useProgram(program)

    // Encode each mipmap level. options.levelRange = [first, last] restricts that to a
    // window; a skipped level costs no draw, no readback and no upload. The point is to stop
    // re-encoding levels the caller already has -- filling one pyramid in two passes
    // otherwise re-encodes the whole chain on the second and throws most of it away.
    //
    // The source's chain is still generated in full above: level `first` has to exist first.
    const firstLevel = Math.max(0, options.levelRange ? options.levelRange[0] | 0 : 0)
    const lastLevel = Math.min(mipmapCount - 1, options.levelRange ? options.levelRange[1] | 0 : mipmapCount - 1)
    if (firstLevel > lastLevel) {
      throw new Error(`levelRange [${firstLevel}, ${lastLevel}] selects no level of a ${mipmapCount}-level encode`)
    }
    let levelsWritten = 0

    for (let mipLevel = firstLevel; mipLevel <= lastLevel; mipLevel++) {
      const mipWidth = Math.max(1, Math.floor(width >> mipLevel))
      const mipHeight = Math.max(1, Math.floor(height >> mipLevel))
      const mipBw = Math.ceil(mipWidth / 4)
      const mipBh = Math.ceil(mipHeight / 4)
      const mipSize = blockSize * mipBw * mipBh
      byteLength += mipSize
      levelsWritten++

      // Bind input texture at current mip level
      gl.bindTexture(gl.TEXTURE_2D, encodeSrcTexture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, mipLevel)

      // Draw fullscreen triangle on the render target using the FBO
      gl.viewport(0, 0, mipBw, mipBh)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      // Copy dst texture to pixel buffer object
      gl.readPixels(0, 0, mipBw, mipBh, gl.RGBA_INTEGER, blockSize === 16 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0)

      // Copy pixel buffer object to compressed texture at the curent mip level
      gl.bindTexture(gl.TEXTURE_2D, compressedTexture)
      gl.compressedTexSubImage2D(gl.TEXTURE_2D, mipLevel + outputBaseLevel, 0, 0, mipWidth, mipHeight, glFormat, mipSize, 0)
    }

    // Cleanup temporary resources (unless cached)
    if (!cacheTempResources) {
      gl.deleteTexture(mipDstTexture)
      gl.deleteBuffer(dstBuffer)
      gl.deleteFramebuffer(fbo)
    }
    // Only the pooled source copy goes back to the pool. Under flipY the encode read from
    // `flippedTexture`, which has IMMUTABLE storage and could never be re-specified for a
    // later encode -- pooling it would be the silent-no-op bug this pool is keyed to avoid.
    if (encodeSrcTexture === srcTexture) {
      this.#releaseSrcTexture(encodeSrcTexture, width, height)
    } else {
      gl.deleteTexture(encodeSrcTexture)
    }

    // Restore GL state
    gl.bindFramebuffer(gl.FRAMEBUFFER, savedState.framebuffer)
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, savedState.readFramebuffer)
    gl.bindTexture(gl.TEXTURE_2D, savedState.textureBinding)
    gl.useProgram(savedState.program)
    gl.activeTexture(savedState.activeTexture)
    gl.viewport(savedState.viewport[0], savedState.viewport[1], savedState.viewport[2], savedState.viewport[3])
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, savedState.pixelPackBuffer)
    gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, savedState.pixelUnpackBuffer)

    // Restore enable/disable state
    if (savedState.blend) gl.enable(gl.BLEND)
    else gl.disable(gl.BLEND)
    if (savedState.depthTest) gl.enable(gl.DEPTH_TEST)
    else gl.disable(gl.DEPTH_TEST)
    if (savedState.stencilTest) gl.enable(gl.STENCIL_TEST)
    else gl.disable(gl.STENCIL_TEST)
    if (savedState.cullFace) gl.enable(gl.CULL_FACE)
    else gl.disable(gl.CULL_FACE)
    if (savedState.scissorTest) gl.enable(gl.SCISSOR_TEST)
    else gl.disable(gl.SCISSOR_TEST)

    // Restore array buffer and VAO binding
    gl.bindBuffer(gl.ARRAY_BUFFER, savedState.arrayBuffer)
    gl.bindVertexArray(savedState.vertexArray)

    this.#timeEnd(timingLabel)

    // Return the compressed texture
    const textureObject = {
      texture: compressedTexture,
      width,
      height,
      format: glFormat,
      sparkFormat: SparkFormatName[format],
      srgb,
      mipmapCount,
      byteLength,
      // Which levels this encode actually wrote, and where they landed in the output
      // texture. Under levelRange these are not mipmapCount levels starting at 0, and a
      // caller that reads mipmapCount alone would believe it has levels nobody encoded.
      levelsWritten,
      firstLevel,
      lastLevel,
      outputBaseLevel
    }

    return textureObject
  }
}

export default SparkGL
