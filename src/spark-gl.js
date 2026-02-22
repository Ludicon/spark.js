// WebGL implementation of spark.js texture compression API
import glslShaders from "./shaders/glsl-shaders.js"
import { assert, loadImage } from "./utils.js"

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
//const GL_RGBA16UI = 0x8239
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
  if (s3tcExt) {
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

  // Strip Vulkan-specific layout qualifiers that aren't compatible with WebGL2
  // Replace "layout(set = N) uniform" with just "uniform"
  shaderCode = shaderCode.replace(/layout\s*\(\s*set\s*=\s*\d+\s*\)\s+uniform/g, "uniform")

  // Remove constant_id layout qualifiers (Vulkan specialization constants)
  shaderCode = shaderCode.replace(/layout\s*\(\s*constant_id\s*=\s*\d+\s*\)\s+const/g, "const")

  return shaderCode
}

const VERTEX_SHADER_SOURCE = `#version 300 es
void main() {
    vec2 uv = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
}
`

function createShader(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compilation failed: ${info}`)
  }

  return shader
}

function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram()
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`Program linking failed: ${info}`)
  }

  return program
}

export class SparkGL {
  #gl
  #supportedFormats
  #shaderCache = new Map()
  #verbose = false
  #encodeCounter = 0

  constructor(gl, options = {}) {
    if (!gl) {
      throw new Error("WebGL2 context is required")
    }
    this.#gl = gl
    this.#verbose = options.verbose ?? false
    this.#supportedFormats = detectWebGLFormats(gl, this.#verbose)

    // Handle preload option
    if (options.preload) {
      this.#preloadShaders(options.preload)
    }
  }

  /**
   * Initialize the encoder by detecting available compression formats.
   * @param {WebGL2RenderingContext} gl - WebGL2 context.
   * @param {Object} options - Encoder options.
   * @param {boolean|string[]} options.preload - Whether to preload all encoder pipelines, or an array of format names to preload (false by default).
   * @param {boolean} options.verbose - Whether to enable verbose logging (false by default).
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
      if (!this.#shaderCache.has(format)) {
        // Don't await — let them compile in the background
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
      : ["bc4-r", "eac-r", "bc5-rg", "eac-rg", "bc7-rgb", "bc1-rgb", "astc-rgb", "astc-4x4-rgb", "etc2-rgb", "bc7-rgba", "astc-rgba", "astc-4x4-rgba"]

    // This allows selecting the best format using a substring like "rgb" or "astc"
    for (const key of preferenceOrder) {
      if (key.includes(format) && this.#isFormatSupported(SparkFormatMap[key])) {
        return SparkFormatMap[key]
      }
    }

    return undefined
  }

  async #loadProgram(format) {
    const cacheKey = format
    if (this.#shaderCache.has(cacheKey)) {
      return this.#shaderCache.get(cacheKey)
    }

    const gl = this.#gl
    const shaderFile = SparkShaderFiles[format]

    if (!shaderFile) {
      throw new Error(`No shader file for format: ${format}`)
    }

    this.#time(`Loading shader: ${shaderFile}`)

    // Load the spark shader code - these are complete fragment shaders
    const fragmentShaderSource = await loadShaderSource(shaderFile)

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE)
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
    const program = createProgram(gl, vertexShader, fragmentShader)

    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)

    this.#timeEnd(`Loading shader: ${shaderFile}`)
    this.#log(`Loaded program for format: ${SparkFormatName[format]}`)

    this.#shaderCache.set(cacheKey, program)
    return program
  }

  async encodeTexture(image, options = {}) {
    const gl = this.#gl

    // Parse options
    let formatOption = options.format

    // Default to "rgb" if no format specified
    if (formatOption === undefined) {
      formatOption = "rgb"
    }

    // Try to get preferred format (handles substrings and exact matches)
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

    this.#log(`Selected format: ${SparkFormatName[format]}`)

    // Load image if it's a URL
    if (typeof image === "string") {
      image = await loadImage(image)
    }

    // Diagnose image type
    this.#log(`Image type: ${image.constructor.name}`)
    this.#log(`Image instanceof HTMLImageElement: ${image instanceof HTMLImageElement}`)
    this.#log(`Image instanceof ImageBitmap: ${image instanceof ImageBitmap}`)
    this.#log(`Image instanceof HTMLCanvasElement: ${image instanceof HTMLCanvasElement}`)
    this.#log(`Image instanceof HTMLVideoElement: ${image instanceof HTMLVideoElement}`)

    const width = image.width || image.videoWidth
    const height = image.height || image.videoHeight
    assert(width && height)

    const blockSize = SparkBlockSize[format]

    // Determine if we should use sRGB format
    const srgb = (options.srgb || options.format?.endsWith("srgb")) && SparkFormatIsRGB[format]
    const glFormatPair = SparkGLFormats[format]
    const glFormat = glFormatPair ? (srgb ? glFormatPair[1] : glFormatPair[0]) : null
    const glUintFormat = SparkGLUintFormats[format]

    this.#log(`Using ${srgb ? "sRGB" : "linear"} color space`)

    // Load and compile shader program
    const program = await this.#loadProgram(format)

    // Make sure we don't have any async code after this!
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
    let mipmapCount = 1
    if (generateMipmaps) {
      const MIN_MIP_SIZE = 4
      let w = width
      let h = height
      while (w >= MIN_MIP_SIZE || h >= MIN_MIP_SIZE) {
        mipmapCount++
        w = Math.max(1, Math.floor(w / 2))
        h = Math.max(1, Math.floor(h / 2))
      }
      this.#log(`Generating ${mipmapCount} mipmap levels`)
    }

    // Create input texture
    const srcTexture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, srcTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, glWrapMode)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, glWrapMode)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, 0)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, image)

    // If flipY is requested, render to an intermediate texture with flipped coordinates
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
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height)

      // Create temporary FBO for flipping
      const flipFbo = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, flipFbo)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, flippedTexture, 0)

      // Simple blit shader to flip the texture
      const blitVs = `#version 300 es
        out vec2 vUV;
        void main() {
          float x = float((gl_VertexID & 1) << 2);
          float y = float((gl_VertexID & 2) << 1);
          vUV.x = x * 0.5;
          vUV.y = 1.0 - (y * 0.5); // Flip Y coordinate
          gl_Position = vec4(x - 1.0, y - 1.0, 0, 1);
        }`

      const blitFs = `#version 300 es
        precision mediump float;
        uniform sampler2D uTexture;
        in vec2 vUV;
        out vec4 fragColor;
        void main() {
          fragColor = texture(uTexture, vUV);
        }`

      const vsShader = gl.createShader(gl.VERTEX_SHADER)
      gl.shaderSource(vsShader, blitVs)
      gl.compileShader(vsShader)

      const fsShader = gl.createShader(gl.FRAGMENT_SHADER)
      gl.shaderSource(fsShader, blitFs)
      gl.compileShader(fsShader)

      const blitProgram = gl.createProgram()
      gl.attachShader(blitProgram, vsShader)
      gl.attachShader(blitProgram, fsShader)
      gl.linkProgram(blitProgram)

      // Render flipped texture
      gl.useProgram(blitProgram)
      gl.viewport(0, 0, width, height)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, srcTexture)
      gl.uniform1i(gl.getUniformLocation(blitProgram, "uTexture"), 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      // Cleanup blit resources
      gl.deleteShader(vsShader)
      gl.deleteShader(fsShader)
      gl.deleteProgram(blitProgram)
      gl.deleteFramebuffer(flipFbo)
      gl.deleteTexture(srcTexture)

      encodeSrcTexture = flippedTexture
    }

    // Create FBO (we'll attach different textures for each mip level)
    const fbo = gl.createFramebuffer()

    // Generate mipmaps if requested
    if (generateMipmaps) {
      gl.bindTexture(gl.TEXTURE_2D, encodeSrcTexture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, mipmapCount - 1)
      gl.generateMipmap(gl.TEXTURE_2D)
      this.#log(`Generated ${mipmapCount} mipmap levels`)
    }

    // Create output compressed texture
    const compressedTexture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, compressedTexture)
    gl.texStorage2D(gl.TEXTURE_2D, mipmapCount, glFormat, width, height)

    // Set texture filtering parameters
    if (generateMipmaps) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    }

    // Set texture wrapping mode (already determined above)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, glWrapMode)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, glWrapMode)

    // Disable rendering state once for all mip levels
    gl.disable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.STENCIL_TEST)
    gl.disable(gl.CULL_FACE)
    gl.disable(gl.SCISSOR_TEST)

    // Flag to control encoding approach
    const BATCH_MIPMAP_ENCODING = false // Set to true to batch all rendering before copies

    if (BATCH_MIPMAP_ENCODING) {
      // Batched approach: render all mips, then copy all mips

      // Calculate total buffer size needed for all mips
      let totalBufferSize = 0
      const mipInfos = []
      for (let mipLevel = 0; mipLevel < mipmapCount; mipLevel++) {
        const mipWidth = Math.max(1, Math.floor(width >> mipLevel))
        const mipHeight = Math.max(1, Math.floor(height >> mipLevel))
        const mipBw = Math.floor((mipWidth + 3) / 4)
        const mipBh = Math.floor((mipHeight + 3) / 4)
        const dstBufferSize = blockSize * mipBw * mipBh

        mipInfos.push({
          mipLevel,
          mipWidth,
          mipHeight,
          mipBw,
          mipBh,
          dstBufferSize,
          bufferOffset: totalBufferSize
        })

        totalBufferSize += dstBufferSize
      }

      this.#log(`Total buffer size for all mips: ${totalBufferSize} bytes`)

      // Create separate render target textures for each mip level
      const dstTextures = []
      for (const info of mipInfos) {
        const tex = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.texStorage2D(gl.TEXTURE_2D, 1, glUintFormat, info.mipBw, info.mipBh)
        dstTextures.push(tex)
      }

      // Create a single large buffer to hold all mip levels
      const dstBuffer = gl.createBuffer()
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, dstBuffer)
      gl.bufferData(gl.PIXEL_PACK_BUFFER, totalBufferSize, gl.STREAM_COPY)
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)

      // Phase 1: Render all mip levels
      this.#log("Phase 1: Rendering all mip levels")
      for (const info of mipInfos) {
        this.#log(`Rendering mip level ${info.mipLevel}: ${info.mipWidth}x${info.mipHeight} (${info.mipBw}x${info.mipBh} blocks)`)

        // Update FBO attachment to this mip's render target
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, dstTextures[info.mipLevel], 0)

        // Setup rendering state
        gl.useProgram(program)

        // Bind input texture to texture unit 0 (at the correct mip level)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, encodeSrcTexture)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, info.mipLevel)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, info.mipLevel)

        // Draw fullscreen triangle on the render target using the FBO
        gl.viewport(0, 0, info.mipBw, info.mipBh)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }

      // Phase 2: Read all mip levels to buffer
      this.#log("Phase 2: Reading all mip levels to buffer")
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, dstBuffer)
      for (const info of mipInfos) {
        this.#log(`Reading mip level ${info.mipLevel} at offset ${info.bufferOffset}`)

        // Bind the correct render target to read from
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, dstTextures[info.mipLevel], 0)
        gl.readBuffer(gl.COLOR_ATTACHMENT0)

        gl.readPixels(0, 0, info.mipBw, info.mipBh, gl.RGBA_INTEGER, blockSize === 16 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, info.bufferOffset)
      }
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)

      // Phase 3: Copy all mip levels to compressed texture
      this.#log("Phase 3: Copying all mip levels to compressed texture")
      gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, dstBuffer)
      gl.bindTexture(gl.TEXTURE_2D, compressedTexture)
      for (const info of mipInfos) {
        this.#log(`Copying mip level ${info.mipLevel} from offset ${info.bufferOffset}`)
        gl.compressedTexSubImage2D(gl.TEXTURE_2D, info.mipLevel, 0, 0, info.mipWidth, info.mipHeight, glFormat, info.dstBufferSize, info.bufferOffset)
      }
      gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null)

      // Cleanup batched resources
      for (const tex of dstTextures) {
        gl.deleteTexture(tex)
      }
      gl.deleteBuffer(dstBuffer)
    } else {
      // Original interleaved approach: render and copy each mip one at a time
      this.#log("Using interleaved encoding approach")

      // Encode each mipmap level (interleaved approach)
      for (let mipLevel = 0; mipLevel < mipmapCount && !BATCH_MIPMAP_ENCODING; mipLevel++) {
        const mipWidth = Math.max(1, Math.floor(width >> mipLevel))
        const mipHeight = Math.max(1, Math.floor(height >> mipLevel))
        const mipBw = Math.floor((mipWidth + 3) / 4)
        const mipBh = Math.floor((mipHeight + 3) / 4)
        const dstBufferSize = blockSize * mipBw * mipBh

        this.#log(`Encoding mip level ${mipLevel}: ${mipWidth}x${mipHeight} (${mipBw}x${mipBh} blocks)`)

        // Create/resize render target for this mip level
        const mipDstTexture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, mipDstTexture)
        gl.texStorage2D(gl.TEXTURE_2D, 1, glUintFormat, mipBw, mipBh)

        // Update FBO attachment
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, mipDstTexture, 0)

        // Create temporary buffer for this mip level
        const dstBuffer = gl.createBuffer()
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, dstBuffer)
        gl.bufferData(gl.PIXEL_PACK_BUFFER, dstBufferSize, gl.STREAM_COPY)
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)

        // Setup rendering state
        gl.useProgram(program)

        // Bind input texture to texture unit 0 (at the correct mip level)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, encodeSrcTexture)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, mipLevel)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, mipLevel)

        // Draw fullscreen triangle on the render target using the FBO
        gl.viewport(0, 0, mipBw, mipBh)
        gl.drawArrays(gl.TRIANGLES, 0, 3)

        // Copy dst texture to pixel buffer object
        gl.readBuffer(gl.COLOR_ATTACHMENT0)
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, dstBuffer)

        gl.readPixels(0, 0, mipBw, mipBh, gl.RGBA_INTEGER, blockSize === 16 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0)

        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)

        // Copy pixel buffer object to compressed texture at the correct mip level
        gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, dstBuffer)
        gl.bindTexture(gl.TEXTURE_2D, compressedTexture)
        gl.compressedTexSubImage2D(gl.TEXTURE_2D, mipLevel, 0, 0, mipWidth, mipHeight, glFormat, dstBufferSize, 0)
        gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null)

        // Cleanup this mip level's temporary resources
        gl.deleteTexture(mipDstTexture)
        gl.deleteBuffer(dstBuffer)
      }
    }

    // Cleanup temporary resources
    gl.deleteFramebuffer(fbo)
    gl.deleteTexture(encodeSrcTexture)

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
      sparkFormat: format,
      sparkFormatName: SparkFormatName[format],
      srgb,
      mipmapCount
    }

    return textureObject
  }
}

export default SparkGL
