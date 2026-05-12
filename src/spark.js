import shaders from "./shaders/wgsl-shaders.js"
import { assert, loadImage, loadImageFromBlob, getSafariVersion, getFirefoxVersion } from "./utils.js"

const SparkFormat = {
  ASTC_4x4_RGB: 0,
  ASTC_4x4_RGBA: 1,
  // ASTC_4x4_RGBM: 2,
  // ASTC_6x6_RGB: 3,
  EAC_R: 4,
  EAC_RG: 5,
  ETC2_RGB: 6,
  // ETC2_RGBA: 7,
  // ETC2_RGBM: 8,
  BC1_RGB: 9,
  // BC3_RGBA: 10,
  // BC3_YCoCg: 11,
  // BC3_RGBM: 12,
  BC4_R: 13,
  BC5_RG: 14,
  // BC6H_RGB: 15,
  BC7_RGB: 16,
  BC7_RGBA: 17
}

const SparkFormatName = [
  /* 0  */ "astc-4x4-rgb", // ASTC_4x4_RGB
  /* 1  */ "astc-4x4-rgba", // ASTC_4x4_RGBA
  /* 2  */ null,
  /* 3  */ null,
  /* 4  */ "eac-r", // EAC_R
  /* 5  */ "eac-rg", // EAC_RG
  /* 6  */ "etc2-rgb", // ETC2_RGB
  /* 7  */ null,
  /* 8  */ null,
  /* 9  */ "bc1-rgb", // BC1_RGB
  /* 10 */ null,
  /* 11 */ null,
  /* 12 */ null,
  /* 13 */ "bc4-r", // BC4_R
  /* 14 */ "bc5-rg", // BC5_RG
  /* 15 */ null,
  /* 16 */ "bc7-rgb", // BC7_RGB
  /* 17 */ "bc7-rgba" // BC7_RGBA
]

const SparkShaderFiles = [
  /* 0  */ "spark_astc_rgb.wgsl", // ASTC_4x4_RGB
  /* 1  */ "spark_astc_rgba.wgsl", // ASTC_4x4_RGBA
  /* 2  */ null,
  /* 3  */ null,
  /* 4  */ "spark_eac_r.wgsl", // EAC_R
  /* 5  */ "spark_eac_rg.wgsl", // EAC_RG
  /* 6  */ "spark_etc2_rgb.wgsl", // ETC2_RGB
  /* 7  */ null,
  /* 8  */ null,
  /* 9  */ "spark_bc1_rgb.wgsl", // BC1_RGB
  /* 10 */ null,
  /* 11 */ null,
  /* 12 */ null,
  /* 13 */ "spark_bc4_r.wgsl", // BC4_R
  /* 14 */ "spark_bc5_rg.wgsl", // BC5_RG
  /* 15 */ null,
  /* 16 */ "spark_bc7_rgb.wgsl", // BC7_RGB
  /* 17 */ "spark_bc7_rgba.wgsl" // BC7_RGBA
]

const SparkBlockSize = [
  /* 0  */ 16, // ASTC_4x4_RGB
  /* 1  */ 16, // ASTC_4x4_RGBA
  /* 2  */ 0,
  /* 3  */ 0,
  /* 4  */ 8, // EAC_R
  /* 5  */ 16, // EAC_RG
  /* 6  */ 8, // ETC2_RGB
  /* 7  */ 0,
  /* 8  */ 0,
  /* 9  */ 8, // BC1_RGB
  /* 10 */ 0,
  /* 11 */ 0,
  /* 12 */ 0,
  /* 13 */ 8, // BC4_R
  /* 14 */ 16, // BC5_RG
  /* 15 */ 0,
  /* 16 */ 16, // BC7_RGB
  /* 17 */ 16 // BC7_RGB
]

const ColorMode = {
  Linear: 0,
  sRGB: 1,
  Alpha: 2,
  Normal: 4,
  // Set when the fragment-shader mipmap path must apply sRGB conversion in shader
  // instead of relying on rgba8unorm-srgb view formats (which are forbidden in compat mode).
  sRGBManual: 8
}

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

  // aliases:
  "astc-rgb": SparkFormat.ASTC_4x4_RGB,
  "astc-rgba": SparkFormat.ASTC_4x4_RGBA,

  // webgpu aliases:
  "bc1-rgba-unorm": SparkFormat.BC1_RGB,
  "bc1-rgba-unorm-srgb": SparkFormat.BC1_RGB,
  "bc4-r-unorm": SparkFormat.BC4_R,
  "bc5-rg-unorm": SparkFormat.BC5_RG,
  "bc7-rgba-unorm": SparkFormat.BC7_RGBA,
  "bc7-rgba-unorm-srgb": SparkFormat.BC7_RGBA,
  "etc2-rgb8unorm": SparkFormat.ETC2_RGB,
  "etc2-rgb8unorm-srgb": SparkFormat.ETC2_RGB,
  "eac-r11unorm": SparkFormat.EAC_R,
  "eac-rg11unorm": SparkFormat.EAC_RG,
  "astc-4x4-unorm": SparkFormat.ASTC_4x4_RGBA,
  "astc-4x4-unorm-srgb": SparkFormat.ASTC_4x4_RGBA
})

const SparkWebGPUFormats = [
  /* 0  */ "astc-4x4-unorm", // ASTC_4x4_RGB
  /* 1  */ "astc-4x4-unorm", // ASTC_4x4_RGBA
  /* 2  */ null,
  /* 3  */ null,
  /* 4  */ "eac-r11unorm", // EAC_R
  /* 5  */ "eac-rg11unorm", // EAC_RG
  /* 6  */ "etc2-rgb8unorm", // ETC2_RGB
  /* 7  */ null,
  /* 8  */ null,
  /* 9  */ "bc1-rgba-unorm", // BC1_RGB
  /* 10 */ null,
  /* 11 */ null,
  /* 12 */ null,
  /* 13 */ "bc4-r-unorm", // BC4_R
  /* 14 */ "bc5-rg-unorm", // BC5_RG
  /* 15 */ null,
  /* 16 */ "bc7-rgba-unorm", // BC7_RGB
  /* 17 */ "bc7-rgba-unorm" // BC7_RGB
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
  /* 17 */ true // BC7_RGB
]

function isFormatRGB(format) {
  return SparkFormatIsRGB[format]
}
function isFormatAlpha(format) {
  return format == SparkFormat.ASTC_4x4_RGBA || format == SparkFormat.BC7_RGBA
}

function isWebGPU(device) {
  return typeof GPUDevice != "undefined" && device instanceof GPUDevice
}

// https://stackoverflow.com/a/9039885/1314762
function isIOS() {
  return (
    ["iPad Simulator", "iPhone Simulator", "iPod Simulator", "iPad", "iPhone", "iPod"].includes(navigator.platform) ||
    // iPad on iOS 13 detection
    (navigator.userAgent.includes("Mac") && "ontouchend" in document)
  )
}

function detectWebGPUFormats(device) {
  const supportedFormats = new Set()

  const formatMap = {
    "texture-compression-bc": [SparkFormat.BC1_RG, SparkFormat.BC4_R, SparkFormat.BC5_RG, SparkFormat.BC7_RGB, SparkFormat.BC7_RGBA],
    "texture-compression-etc2": [SparkFormat.ETC2_RGB, SparkFormat.EAC_R, SparkFormat.EAC_RG],
    "texture-compression-astc": [SparkFormat.ASTC_4x4_RGB, SparkFormat.ASTC_4x4_RGBA]
  }

  for (const [feature, formats] of Object.entries(formatMap)) {
    if (device.features.has(feature)) {
      for (const format of formats) {
        supportedFormats.add(format)
      }
    }
  }

  return supportedFormats
}

function imageToByteArray(image) {
  const width = image.displayWidth ?? image.width
  const height = image.displayHeight ?? image.height

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext("2d")
  ctx.drawImage(image, 0, 0)

  const imageData = ctx.getImageData(0, 0, width, height)
  return new Uint8Array(imageData.data.buffer)
}

// This is prescribed by WebGPU.
const BYTES_PER_ROW_ALIGNMENT = 256

// Let's not waste time generating mips below this size:
const MIN_MIP_SIZE = 4

function computeMipmapLayout(w, h, blockSize, mipmaps) {
  let mipmapCount = 0
  let offset = 0
  const bufferRanges = []

  do {
    const bw = Math.ceil(w / 4)
    const bh = Math.ceil(h / 4)
    const bytesPerRow = Math.ceil((bw * blockSize) / BYTES_PER_ROW_ALIGNMENT) * BYTES_PER_ROW_ALIGNMENT
    const alignedSize = bh * bytesPerRow

    mipmapCount++

    bufferRanges.push({ offset, alignedSize, w, h, bw, bh, bytesPerRow })

    offset += alignedSize

    w = Math.max(1, Math.floor(w / 2))
    h = Math.max(1, Math.floor(h / 2))
  } while (mipmaps && (w >= MIN_MIP_SIZE || h >= MIN_MIP_SIZE))

  return { mipmapCount, outputSize: offset, bufferRanges }
}

class Spark {
  #device
  #supportedFormats
  #supportsFloat16
  #useFragmentShader = false
  #compatibilityMode = false
  #pipelines = []
  #mipmapPipeline
  #magicMipmapPipeline
  #resizePipeline
  #flipYPipeline
  #detectChannelCountPipeline

  #defaultSampler
  #uniformBuffer
  #querySet
  #queryBuffer
  #queryReadbackBuffer

  #cacheTempResources = false
  #cachedInputTexture = null
  #cachedTmpTexture = null
  #cachedOutputBuffer = null

  #encodeCounter = 0
  #verbose = false

  /**
   * Initialize the encoder by detecting available compression formats.
   * @param {GPUDevice} device - WebGPU device.
   * @param {Object} options - Encoder options.
   * @param {boolean} options.preload - Whether to preload all encoder pipelines (false by default).
   * @param {boolean} options.cacheTempResources - Whether to cache temporary resources for reuse across encodeTexture calls (false by default).
   * @param {boolean} options.verbose - Whether to enable verbose logging (false by default).
   * @returns {Promise<void>} Resolves when initialization is complete.
   */
  static async create(device, options = {}) {
    const instance = new Spark()
    await instance.#init(
      device,
      options.preload ?? false,
      options.useTimestampQueries ?? false,
      options.verbose ?? false,
      options.cacheTempResources ?? false
    )
    return instance
  }

  dispose() {
    for (const pipeline of this.#pipelines) {
      pipeline.destroy()
    }
    this.#mipmapPipeline.destroy()
    this.#resizePipeline.destroy()
    this.#flipYPipeline.destroy()
    this.#detectChannelCountPipeline.destroy()

    this.#defaultSampler.destroy()
    for (let i = 0; i < 3; i++) {
      this.#uniformBuffer[i].destroy()
    }
    this.#querySet.destroy()
    this.#queryBuffer.destroy()
    this.#queryReadbackBuffer.destroy()

    this.freeTempResources()
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

  /**
   * Free cached temporary resources used by encodeTexture.
   * Call this when you're done encoding textures to free up GPU memory.
   */
  freeTempResources() {
    if (this.#cachedInputTexture) {
      this.#cachedInputTexture.destroy()
      this.#cachedInputTexture = null
    }

    if (this.#cachedTmpTexture) {
      this.#cachedTmpTexture.destroy()
      this.#cachedTmpTexture = null
    }

    if (this.#cachedOutputBuffer) {
      this.#cachedOutputBuffer.destroy()
      this.#cachedOutputBuffer = null
    }
  }

  /**
   * Returns a list of supported texture compression format names.
   *
   * This function checks a predefined list of common GPU compression formats
   * (ASTC, ETC2, EAC, BCn) and filters it based on the formats actually supported
   * by the current device as determined by `Spark.supportedFormats`.
   *
   * @returns {string[]} An array of format names (e.g., "bc1-rgb", "astc-4x4-rgba") that are supported on the current device.
   *
   * @example
   * const spark = await Spark.create(device);
   * const formats = spark.getSupportedFormats();
   * console.log("Supported formats:", formats);
   */
  getSupportedFormats() {
    return Array.from(this.#supportedFormats)
      .map(format => SparkFormatName[format])
      .filter(Boolean)
  }

  /**
   * Returns whether the given format is supported on the current device.
   *
   * @param {string} format
   * @returns {boolean} `true` if the format is supported, `false` otherwise.
   */
  isFormatSupported(format) {
    const sparkFormat = typeof format === "string" ? SparkFormatMap[format] : format
    return this.#supportedFormats.has(sparkFormat)
  }

  /**
   * Determines the set of WebGPU features to request when initializing the device.
   *
   * This function inspects the given `adapter` to see which texture compression and shader
   * features are available, and returns a list of those that are both supported and safe to enable.
   *
   * @param {GPUAdapter} adapter - The WebGPU adapter returned from `navigator.gpu.requestAdapter()`.
   * @returns {string[]} An array of WebGPU feature names to request during `adapter.requestDevice()`.
   *
   * @example
   * // Create device using the features required by spark.js
   * const adapter = await navigator.gpu.requestAdapter()
   * const requiredFeatures = Spark.getRequiredFeatures(adapter)
   * const device = await adapter.requestDevice({ requiredFeatures })
   *
   * // Create spark object for the given device.
   * const spark = Spark.create(device)
   */
  static getRequiredFeatures(adapter) {
    const features = []

    const IOS = isIOS()

    // BC1 through BC5 and BC6H/BC7 are grouped under "texture-compression-bc"
    // Support for BC formats in Safari/iOS was broken, so we avoid them until the bug is fixed:
    // https://bugs.webkit.org/show_bug.cgi?id=295566
    // https://github.com/WebKit/WebKit/pull/47725
    if (!IOS && adapter.features.has("texture-compression-bc")) {
      features.push("texture-compression-bc")
    }

    // ETC1/ETC2 formats
    if (adapter.features.has("texture-compression-etc2")) {
      features.push("texture-compression-etc2")
    }

    // ASTC formats
    if (adapter.features.has("texture-compression-astc")) {
      features.push("texture-compression-astc")
    }

    // Request f16 support.
    if (adapter.features.has("shader-f16")) {
      features.push("shader-f16")
    }

    // Request timestamp-query support.
    if (adapter.features.has("timestamp-query")) {
      features.push("timestamp-query")
    }

    return features
  }

  /**
   * Try to determine the best compression options automatically. Do not use this in production, this is
   * for the convenience of the spark.js image viewer only.
   *
   * @param {string | HTMLImageElement | ImageBitmap | GPUTexture} source - Image input.
   * @param {Object} options - Encoding options.
   * @returns {Object} - Recommended encoding options with an explicit encoding format.
   */
  async selectPreferredOptions(source, options = {}) {
    // Only load the image if the format has not been specified by the user.
    if (options.format == undefined || options.format == "auto") {
      const direct =
        source instanceof Image ||
        source instanceof ImageBitmap ||
        source instanceof HTMLCanvasElement ||
        (typeof OffscreenCanvas !== "undefined" && source instanceof OffscreenCanvas) ||
        (typeof VideoFrame !== "undefined" && source instanceof VideoFrame) ||
        source instanceof GPUTexture
      const image = direct ? source : source instanceof Blob ? await loadImageFromBlob(source) : await loadImage(source)

      try {
        options.format = "auto"
        const format = await this.#getBestMatchingFormat(options, image)

        options.format = SparkFormatName[format]

        // Set srgb flag automatically.
        if (image instanceof GPUTexture) {
          if (image.format.endsWith("-srgb")) options.srgb = true
        }

        if (format == SparkFormat.EAC_RG || format == SparkFormat.BC5_RG) {
          // Assume it's a normal map.
          options.normal = true
        }
      } finally {
        if (!direct) image.close?.()
      }
    }

    return options
  }

  /**
   * Load an image and encode it to a compressed GPU texture.
   *
   * @param {string | HTMLImageElement | ImageBitmap | HTMLCanvasElement | OffscreenCanvas | VideoFrame | GPUTexture} source
   *        The image to encode. Can be a GPUTexture, URL, DOM image, ImageBitmap,
   *        HTMLCanvasElement, OffscreenCanvas, or VideoFrame.
   *
   * @param {Object} [options] - Optional configuration for encoding.
   *
   * @param {string} [options.format="rgb"]
   *        Desired block compression format. Can be specified in several ways:
   *          - A channel mask indicating the number of channels in your input:
   *            "rgba", "rgb", "rg", or "r". The actual GPU format is selected
   *            based on device capabilities.
   *          - An explicit WebGPU BC, ETC, or ASTC format name, or an abbreviated
   *            form such as "bc7" or "astc". Note: only 4x4 LDR formats are supported.
   *          - "auto" to analyze the input texture and detect the required channels.
   *            This has some overhead, so specifying a format explicitly is preferred.
   *
   * @param {boolean} [options.mips=false] | [options.generateMipmaps=false]
   *        Whether to generate mipmaps.
   *
   * @param {string} [options.mipmapFilter="magic"]
   *        The filter to use for mipmap generation. Can be "box" for a simple box filter,
   *        or "magic" for a higher-quality 4-tap filter with sharpening properties.
   *
   * @param {number[]} [options.mipsAlphaScale]
   *        Optional array of alpha scale values to apply to each generated mipmap level.
   *        The array should contain one value per mipmap level (starting with mip level 1,
   *        since level 0 is the base image). Each value multiplies the alpha channel of
   *        the corresponding mipmap level.
   *
   * @param {boolean} [options.srgb=false]
   *        Whether to encode the image in an sRGB format. Also affects mipmap generation.
   *        The `srgb` mode can also be inferred from the `format`.
   *
   * @param {boolean} [options.normal=false]
   *        Interpret the image as a normal map. Affects automatic format selection,
   *        favoring "bc5" and "eac-rg" formats.
   *
   * @param {boolean} [options.flipY=false]
   *        Whether to vertically flip the image before encoding.
   *
   * @returns {Promise<GPUTexture>} A promise resolving to the encoded GPU texture.
   */
  async encodeTexture(source, options = {}) {
    assert(this.#device, "Spark is not initialized")

    const isVideoFrame = typeof VideoFrame !== "undefined" && source instanceof VideoFrame

    // Anything we don't recognize as a directly-usable source (URL strings, etc.) is fed
    // through loadImage. We recurse so we own the returned image and can close it;
    // loadImage may return a VideoFrame on Firefox.
    const isDirectSource =
      source instanceof Image ||
      source instanceof ImageBitmap ||
      source instanceof HTMLCanvasElement ||
      (typeof OffscreenCanvas !== "undefined" && source instanceof OffscreenCanvas) ||
      isVideoFrame ||
      source instanceof GPUTexture

    if (!isDirectSource) {
      const loaded = source instanceof Blob ? await loadImageFromBlob(source) : await loadImage(source)
      try {
        return await this.encodeTexture(loaded, options)
      } finally {
        loaded.close?.()
      }
    }

    // Firefox's WebGPU does not yet accept VideoFrame in copyExternalImageToTexture.
    // Convert to ImageBitmap and recurse so cleanup stays localized.
    if (getFirefoxVersion() && isVideoFrame) {
      if (source.format == "BGRA" || source.format == "BGRX") {
        // Choose BGRA format to avoid pixel format conversion in copyExternalImageToTexture.
        options.input_bgra = true
      }
      const bitmap = await createImageBitmap(source)
      try {
        return await this.encodeTexture(bitmap, options)
      } finally {
        bitmap.close()
      }
    }

    const image = source
    this.#log("Loaded image", image)

    // VideoFrame uses displayWidth/displayHeight instead of width/height.
    const srcWidth = image.displayWidth ?? image.width
    const srcHeight = image.displayHeight ?? image.height

    const format = await this.#getBestMatchingFormat(options, image)

    // Start loading the pipeline as soon as we know the format.
    const pipelinePromise = this.#loadPipeline(format)

    // Round up the size to meet WebGPU requirements.
    // It would be great if this contstraint was optional. The only API still requiring it is D3D12.
    const width = Math.ceil(srcWidth / 4) * 4
    const height = Math.ceil(srcHeight / 4) * 4
    const blockSize = SparkBlockSize[format]
    const mipmaps = options.generateMipmaps || options.mips

    const { mipmapCount, outputSize, bufferRanges } = computeMipmapLayout(width, height, blockSize, mipmaps)

    // @@ Add a warning when the user requests srgb, but the selected format does not support it.
    // @@ We could potentially use a smaller format if the compressed format has fewer channels.
    const srgb = (options.srgb || options.format?.endsWith("srgb")) && isFormatRGB(format)

    let colorMode = srgb ? ColorMode.sRGB : ColorMode.Linear
    if (isFormatAlpha(format)) colorMode |= ColorMode.Alpha
    if (options.normal) colorMode = ColorMode.Normal
    // In compat mode we keep the scratch texture as rgba8unorm (so the encoder bind group
    // doesn't apply an unwanted sRGB decode); the mipmap fragment shader applies sRGB
    // averaging in shader instead. This bit toggles that path.
    if ((colorMode & ColorMode.sRGB) && this.#compatibilityMode) colorMode |= ColorMode.sRGBManual

    const webgpuFormat = SparkWebGPUFormats[format] + (srgb ? "-srgb" : "")

    // For now let's just create a texture. Ideally we would use a staging buffer, but in WebGPU it's not possible to create a bufer that
    // both the host can write to and the device can read from a compute shader, so in practice we would need two buffers and to perform
    // an additional copy. This may still be faster than allocating a texture, but would consume more memory. Also, ideally we could use
    // a single temporary texture that is reused for all texture uploads, and resized/freed as needed.

    // Allocate input texture. @@ This texture could be persistent.
    const counter = this.#encodeCounter++
    this.#time("create input texture #" + counter)

    let inputUsage = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    if (this.#useFragmentShader) {
      inputUsage |= GPUTextureUsage.RENDER_ATTACHMENT
    } else {
      inputUsage |= GPUTextureUsage.STORAGE_BINDING
    }
    const inputFormat = options.input_bgra ? "bgra8unorm" : "rgba8unorm"

    // Compatibility mode forbits multi-format views, so we do not alias and rely on sRGBManual in the shader.
    const inputViewFormats = this.#compatibilityMode
      ? undefined
      : options.input_bgra
        ? srgb
          ? ["bgra8unorm", "bgra8unorm-srgb"]
          : ["bgra8unorm"]
        : srgb
          ? ["rgba8unorm", "rgba8unorm-srgb"]
          : ["rgba8unorm"]

    const needsProcessing = options.flipY || width != srcWidth || height != srcHeight

    if (!needsProcessing && !(image instanceof GPUTexture)) {
      inputUsage |= GPUTextureUsage.RENDER_ATTACHMENT // This is only necessary for the copyExternalImageToTexture codepath.
    }

    const commandEncoder = this.#device.createCommandEncoder()

    commandEncoder.pushDebugGroup?.("spark process texture")

    if (this.#querySet && typeof commandEncoder.writeTimestamp === "function") {
      commandEncoder.writeTimestamp(this.#querySet, 0)
    }

    let inputTexture

    if (needsProcessing || !(image instanceof GPUTexture && !mipmaps)) {
      // Create or reuse input texture
      const needsRealloc =
        !this.#cacheTempResources ||
        !this.#cachedInputTexture ||
        this.#cachedInputTexture.width < width ||
        this.#cachedInputTexture.height < height ||
        this.#cachedInputTexture.format != inputFormat ||
        this.#cachedInputTexture.mipLevelCount < mipmapCount

      if (this.#cacheTempResources && this.#cachedInputTexture && !needsRealloc) {
        inputTexture = this.#cachedInputTexture
      } else {
        if (this.#cacheTempResources && this.#cachedInputTexture) {
          this.#cachedInputTexture.destroy()
        }
        inputTexture = this.#device.createTexture({
          size: [width, height, 1],
          mipLevelCount: mipmapCount,
          format: inputFormat,
          usage: inputUsage,
          ...(inputViewFormats ? { inputViewFormats } : {})
        })
        if (this.#cacheTempResources) {
          this.#cachedInputTexture = inputTexture
        }
      }
    }

    let tmpTexture

    if (needsProcessing) {
      if (image instanceof GPUTexture) {
        this.#processInputTexture(commandEncoder, image, inputTexture, width, height, srgb, options.flipY)
      } else {
        // Create or reuse temporary texture using the input size
        const needsTmpRealloc =
          !this.#cacheTempResources ||
          !this.#cachedTmpTexture ||
          this.#cachedTmpTexture.width < srcWidth ||
          this.#cachedTmpTexture.height < srcHeight ||
          this.#cachedInputTexture.format != inputFormat

        if (this.#cacheTempResources && this.#cachedTmpTexture && !needsTmpRealloc) {
          tmpTexture = this.#cachedTmpTexture
        } else {
          if (this.#cacheTempResources && this.#cachedTmpTexture) {
            this.#cachedTmpTexture.destroy()
          }
          tmpTexture = this.#device.createTexture({
            size: [srcWidth, srcHeight, 1],
            mipLevelCount: 1,
            format: inputFormat,
            // RENDER_ATTACHMENT usage is necessary for copyExternalImageToTexture
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
            ...(inputViewFormats ? { inputViewFormats } : {})
          })
          if (this.#cacheTempResources) {
            this.#cachedTmpTexture = tmpTexture
          }
        }

        this.#device.queue.copyExternalImageToTexture({ source: image }, { texture: tmpTexture }, { width: srcWidth, height: srcHeight })

        this.#processInputTexture(commandEncoder, tmpTexture, inputTexture, width, height, colorMode, options.flipY)
      }
    } else {
      if (image instanceof GPUTexture) {
        if (mipmaps) {
          // This copy is only necessary because input texture is expected to have mipmaps. It would be faster to
          // have a special case for mip 0 and use a separate texture for the remaining mips.

          // If input is a texture, copy the texture.
          commandEncoder.copyTextureToTexture({ texture: image }, { texture: inputTexture }, { width, height })
        } else {
          inputTexture = image
        }
      } else {
        // Otherwise copy external image.
        this.#device.queue.copyExternalImageToTexture({ source: image }, { texture: inputTexture }, { width, height })
      }
    }

    if (mipmaps) {
      this.#generateMipmaps(commandEncoder, inputTexture, mipmapCount, width, height, colorMode, options.mipsAlphaScale, options.mipmapFilter)
    }

    commandEncoder.popDebugGroup?.()

    this.#timeEnd("create input texture #" + counter)

    // Allocate output texture.
    const reuseTexture =
      options.outputTexture &&
      options.outputTexture.width == width &&
      options.outputTexture.height == height &&
      options.outputTexture.mipLevelCount == mipmapCount &&
      options.outputTexture.format == webgpuFormat

    const outputTexture = reuseTexture
      ? options.outputTexture
      : this.#device.createTexture({
          size: [width, height, 1],
          mipLevelCount: mipmapCount,
          format: webgpuFormat,
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
        })

    // Create or reuse output buffer
    let outputBuffer
    if (this.#cacheTempResources && this.#cachedOutputBuffer && this.#cachedOutputBuffer.size >= outputSize) {
      outputBuffer = this.#cachedOutputBuffer
    } else {
      if (this.#cacheTempResources && this.#cachedOutputBuffer) {
        this.#cachedOutputBuffer.destroy()
      }
      outputBuffer = this.#device.createBuffer({
        size: outputSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
      })
      if (this.#cacheTempResources) {
        this.#cachedOutputBuffer = outputBuffer
      }
    }

    // Dispatch compute shader to encode the input texture in the output buffer.
    const label = `dispatch compute shader '${SparkFormatName[format]}' #${counter}`
    this.#time(label)

    commandEncoder.pushDebugGroup?.("spark encode texture")

    let args = {}
    if (this.#querySet && typeof commandEncoder.writeTimestamp !== "function") {
      args = {
        writeTimestamps: {
          querySet: this.#querySet,
          beginningOfPassWriteIndex: 0,
          endOfPassWriteIndex: 1
        }
      }
    }

    // Make sure the pipeline is loaded. Wait if necessary.
    const pipeline = await pipelinePromise

    const pass = commandEncoder.beginComputePass(args)
    pass.setPipeline(pipeline)

    for (let m = 0; m < mipmapCount; m++) {
      const bindGroup = this.#device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: inputTexture.createView({
              baseMipLevel: m,
              mipLevelCount: 1
            })
          },
          {
            binding: 1,
            resource: this.#defaultSampler
          },
          {
            binding: 2,
            resource: {
              buffer: outputBuffer,
              offset: bufferRanges[m].offset,
              size: bufferRanges[m].size
            }
          }
        ]
      })

      pass.setBindGroup(0, bindGroup)
      // Encoder shaders use @workgroup_size(16, 8, 1) to stay within compat mode's
      // maxComputeInvocationsPerWorkgroup limit of 128.
      pass.dispatchWorkgroups(Math.ceil(bufferRanges[m].bw / 16), Math.ceil(bufferRanges[m].bh / 8))
    }

    pass.end()

    for (let m = 0; m < mipmapCount; m++) {
      // Copy from output buffer to output texture
      commandEncoder.copyBufferToTexture(
        {
          buffer: outputBuffer,
          offset: bufferRanges[m].offset,
          bytesPerRow: bufferRanges[m].bytesPerRow,
          rowsPerImage: bufferRanges[m].bh
        },
        {
          texture: outputTexture,
          mipLevel: m
        },
        {
          width: bufferRanges[m].bw * 4,
          height: bufferRanges[m].bh * 4,
          depthOrArrayLayers: 1
        }
      )
    }

    if (this.#querySet && typeof commandEncoder.writeTimestamp === "function") {
      commandEncoder.writeTimestamp(this.#querySet, 1)
    }

    commandEncoder.popDebugGroup?.()

    this.#device.queue.submit([commandEncoder.finish()])

    this.#timeEnd(label)

    // Cleanup temporary resources (unless cached)
    if (!this.#cacheTempResources) {
      tmpTexture?.destroy()
      if (inputTexture != image) {
        inputTexture?.destroy()
      }
      outputBuffer?.destroy()
    }

    return outputTexture
  }

  /**
   * Returns the time (in milliseconds) it took to perform the most recent `encodeTexture()` call.
   *
   * This function resolves GPU timestamp queries that were recorded before and after the
   * compression dispatch in `encodeTexture()`. It waits for the GPU to finish processing,
   * reads back the timestamps, and computes the elapsed GPU time.
   *
   * Must be called *after* `encodeTexture()` has been invoked and submitted.
   *
   * @async
   * @returns {Promise<number>} Elapsed GPU time in milliseconds.
   *
   * @example
   * await spark.encodeTexture(...);
   * const elapsed = await spark.getTimeElapsed();
   * console.log(`Encode took ${elapsed.toFixed(2)} ms`);
   *
   * @throws {Error} If the GPU work has not been submitted, or if timestamp queries fail.
   */
  async getTimeElapsed() {
    if (!this.#querySet) {
      return 0
      //throw new Error("Timestamp queries not supported.");
    }

    const commandEncoder = this.#device.createCommandEncoder()

    commandEncoder.resolveQuerySet(this.#querySet, 0, 2, this.#queryBuffer, 0)

    // This copyBufferToBuffer crashes on current Safari.
    // Must use the 5 argument variant, the 3 argument variant crashes in Opera.
    commandEncoder.copyBufferToBuffer(this.#queryBuffer, 0, this.#queryReadbackBuffer, 0, 16)

    this.#device.queue.submit([commandEncoder.finish()])

    await this.#device.queue.onSubmittedWorkDone()

    await this.#queryReadbackBuffer.mapAsync(GPUMapMode.READ)
    const arrayBuffer = this.#queryReadbackBuffer.getMappedRange()
    const timestamps = new BigUint64Array(arrayBuffer)

    const t0 = timestamps[0]
    const t1 = timestamps[1]

    this.#queryReadbackBuffer.unmap()

    const elapsedNanoseconds = Number(t1 - t0)
    const elapsedMilliseconds = elapsedNanoseconds / 1e6

    return elapsedMilliseconds
  }

  async #init(device, preload, useTimestampQueries, verbose, cacheTempResources) {
    assert(device, "device is required")
    assert(isWebGPU(device), "device is not a WebGPU device")

    this.#device = device
    this.#verbose = verbose
    this.#cacheTempResources = cacheTempResources
    // Core devices expose the "core-features-and-limits" feature; compat devices don't.
    this.#compatibilityMode = !device.features.has("core-features-and-limits")

    this.#supportedFormats = detectWebGPUFormats(this.#device)
    this.#defaultSampler = this.#device.createSampler({
      magFilter: "linear",
      minFilter: "linear"
    })

    // Create uniform buffer for the mipmap shader.
    this.#uniformBuffer = this.#device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })

    if (useTimestampQueries && this.#device.features.has("timestamp-query")) {
      const webkitVersion = getSafariVersion()
      const firefoxVersion = getFirefoxVersion()

      // Safari: Copies from the query buffer to the readback buffer crash on Safari prior version 26.
      // Firefox: these createBuffers cause a device lost during shader module compilation. Maybe only on MacOS?
      if ((!webkitVersion || webkitVersion >= 26) && !firefoxVersion) {
        this.#querySet = this.#device.createQuerySet({
          type: "timestamp",
          count: 2
        })

        this.#queryBuffer = this.#device.createBuffer({
          size: 16, // 2 timestamps × 8 bytes each
          usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.QUERY_RESOLVE
        })

        this.#queryReadbackBuffer = this.#device.createBuffer({
          size: 16, // 2 timestamps × 8 bytes each
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        })
      }
    }

    this.#supportsFloat16 = this.#device.features.has("shader-f16")

    // @@ Do this in parallel.
    await this.#loadUtilPipelines()

    // Kick off parallel compilation of supported formats. Should we only compile a subset requested by the user?
    if (preload) {
      let formatsToLoad
      if (Array.isArray(preload)) {
        formatsToLoad = preload.map(n => this.#getPreferredFormat(n, false))
      } else {
        formatsToLoad = this.#supportedFormats
      }

      for (const format of formatsToLoad) {
        if (format !== undefined && !this.#pipelines[format]) {
          // Don't await — let them compile in the background
          this.#loadPipeline(format).catch(err => {
            console.error(`Failed to preload pipeline for format ${format}:`, err)
          })
        }
      }
    }
  }

  async #loadUtilPipelines() {
    // Load shader and pipeline
    const shaderModule = this.#device.createShaderModule({
      code: await shaders["utils.wgsl"](),
      label: "utils"
    })

    // Optional: check for compilation errors
    if (typeof shaderModule.compilationInfo == "function") {
      const info = await shaderModule.compilationInfo()
      if (info.messages.some(msg => msg.type == "error")) {
        console.error("WGSL compilation errors:")
        for (const msg of info.messages) {
          console.error(msg)
        }
        throw new Error("Shader compilation failed")
      }
    }

    // To work around bugs in Firefox that are not fixed as of r148, we have to generate mipmaps
    // using fragment shaders and render passes. This is because Firefox does not correctly support
    // textures with srgb and non-srgb view formats, which makes it impossible to use an srgb
    // texture for storage. For more details see:
    // https://github.com/Ludicon/spark.js/issues/1
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1977241
    const firefoxVersion = getFirefoxVersion()
    if (firefoxVersion || this.#compatibilityMode) {
      // Compatibility mode disallows binding the same texture through views with
      // different formats (the rgba8unorm <-> rgba8unorm-srgb trick), so we have to
      // use the fragment-shader path that does not rely on storage textures.
      this.#useFragmentShader = true
    }

    if (this.#useFragmentShader) {
      this.#mipmapPipeline = {}
      this.#resizePipeline = {}
      this.#flipYPipeline = {}

      const formats = ["rgba8unorm-srgb", "rgba8unorm"]

      for (const format of formats) {
        this.#mipmapPipeline[format] = this.#device.createRenderPipeline({
          label: `mipmap-pipeline-${format}`,
          layout: "auto",
          vertex: {
            module: shaderModule,
            entryPoint: "fullscreen_vs"
          },
          fragment: {
            module: shaderModule,
            entryPoint: "mipmap_fs",
            targets: [{ format }]
          },
          primitive: {
            topology: "triangle-strip",
            stripIndexFormat: "uint32"
          }
        })

        this.#resizePipeline[format] = this.#device.createRenderPipeline({
          label: `resize-pipeline-${format}`,
          layout: "auto",
          vertex: {
            module: shaderModule,
            entryPoint: "fullscreen_vs"
          },
          fragment: {
            module: shaderModule,
            entryPoint: "resize_fs",
            targets: [{ format }]
          },
          primitive: {
            topology: "triangle-strip",
            stripIndexFormat: "uint32"
          }
        })

        this.#flipYPipeline[format] = this.#device.createRenderPipeline({
          label: `flip-y-pipeline-${format}`,
          layout: "auto",
          vertex: {
            module: shaderModule,
            entryPoint: "fullscreen_vs"
          },
          fragment: {
            module: shaderModule,
            entryPoint: "flipy_fs",
            targets: [{ format }]
          },
          primitive: {
            topology: "triangle-strip",
            stripIndexFormat: "uint32"
          }
        })
      }
    } else {
      this.#mipmapPipeline = this.#device.createComputePipeline({
        layout: "auto",
        compute: {
          module: shaderModule,
          entryPoint: "mipmap"
        }
      })

      this.#magicMipmapPipeline = this.#device.createComputePipeline({
        layout: "auto",
        compute: {
          module: shaderModule,
          entryPoint: "magic_mipmap"
        }
      })

      this.#resizePipeline = this.#device.createComputePipeline({
        layout: "auto",
        compute: {
          module: shaderModule,
          entryPoint: "resize"
        }
      })

      this.#flipYPipeline = this.#device.createComputePipeline({
        layout: "auto",
        compute: {
          module: shaderModule,
          entryPoint: "flipy"
        }
      })
    }

    this.#detectChannelCountPipeline = await this.#device.createComputePipelineAsync({
      layout: "auto",
      compute: {
        module: shaderModule,
        entryPoint: "detect_channel_count"
      }
    })
  }

  #loadPipeline(format) {
    if (this.#pipelines[format]) {
      return this.#pipelines[format]
    }

    const pipelinePromise = (async () => {
      this.#time("loadPipeline " + SparkFormatName[format])

      const shaderFile = SparkShaderFiles[format]
      assert(shaderFile, `No shader available for format ${SparkFormatName[format]}`)

      let shaderCode = await shaders[shaderFile]()

      if (!this.#supportsFloat16) {
        // @@ Implement a faster parser?
        // prettier-ignore
        shaderCode = shaderCode
          .replace(/^enable f16;\s*/m, "")            // remove prefix
          .replace(/\bf16\b/g, "f32")                 // replace f16 by f32
          .replace(/\bvec([234])h\b/g, "vec$1f")      // replace half vectors
          .replace(/\bmat([234]x[234])h/g, "mat$1f")  // replace half matrices
          .replace(/\b(\d*\.\d+|\d+\.)h\b/g, "$1") // replace half literals
      }

      const shaderModule = this.#device.createShaderModule({
        code: shaderCode,
        label: SparkFormatName[format]
      })

      // Optional: check for compilation errors
      if (typeof shaderModule.getCompilationInfo == "function") {
        const info = await shaderModule.getCompilationInfo()
        if (info.messages.some(msg => msg.type == "error")) {
          console.error("WGSL compilation errors:")
          for (const msg of info.messages) {
            console.error(msg)
          }
          throw new Error("Shader compilation failed")
        }
      }

      const pipeline = await this.#device.createComputePipelineAsync({
        layout: "auto",
        compute: {
          module: shaderModule,
          entryPoint: "main"
        }
      })

      this.#timeEnd("loadPipeline " + SparkFormatName[format])

      return pipeline
    })()

    this.#pipelines[format] = pipelinePromise
    return pipelinePromise
  }

  #isFormatSupported(format) {
    return this.#supportedFormats.has(format)
  }

  #getPreferredFormat(format, preferLowQuality) {
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
  }

  async #getBestMatchingFormat(options, image) {
    if (options.format == undefined) {
      options.format = "rgb"
    } else if (options.format == "auto") {
      if (options.srgb) {
        if (this.#isFormatSupported(SparkFormat.BC7_RGB)) return SparkFormat.BC7_RGB
        if (this.#isFormatSupported(SparkFormat.ASTC_4x4_RGB)) return SparkFormat.ASTC_4x4_RGB
        if (this.#isFormatSupported(SparkFormat.BC1_RGB)) return SparkFormat.BC1_RGB
        if (this.#isFormatSupported(SparkFormat.ETC2_RGB)) return SparkFormat.ETC2_RGB
      } else if (options.normal) {
        if (this.#isFormatSupported(SparkFormat.BC5_RG)) return SparkFormat.BC5_RG
        if (this.#isFormatSupported(SparkFormat.EAC_RG)) return SparkFormat.EAC_RG
      } else {
        let channelCount
        if (image instanceof GPUTexture) {
          // Take shortcuts for formats with reduced channel counts.
          if (image.format == "r8unorm" || image.format == "r16unorm") channelCount = 1
          else if (image.format == "rg8unorm" || image.format == "rg16unorm") channelCount = 2
          else {
            channelCount = await this.#detectChannelCountGPU(image)
          }
        } else {
          const buffer = imageToByteArray(image)
          channelCount = this.#detectChannelCount(buffer)
        }

        if (channelCount == 4) {
          if (this.#isFormatSupported(SparkFormat.BC7_RGBA)) return SparkFormat.BC7_RGBA
          if (this.#isFormatSupported(SparkFormat.ASTC_4x4_RGBA)) return SparkFormat.ASTC_4x4_RGBA
        } else if (channelCount == 3) {
          if (this.#isFormatSupported(SparkFormat.BC7_RGB)) return SparkFormat.BC7_RGB
          if (this.#isFormatSupported(SparkFormat.ASTC_4x4_RGB)) return SparkFormat.ASTC_4x4_RGB
          if (this.#isFormatSupported(SparkFormat.BC1_RGB)) return SparkFormat.BC1_RGB
          if (this.#isFormatSupported(SparkFormat.ETC2_RGB)) return SparkFormat.ETC2_RGB
        } else if (channelCount == 2) {
          if (this.#isFormatSupported(SparkFormat.BC5_RG)) return SparkFormat.BC5_RG
          if (this.#isFormatSupported(SparkFormat.EAC_RG)) return SparkFormat.EAC_RG
        } else if (channelCount == 1) {
          if (this.#isFormatSupported(SparkFormat.BC4_R)) return SparkFormat.BC4_R
          if (this.#isFormatSupported(SparkFormat.EAC_R)) return SparkFormat.EAC_R
        }
      }

      throw new Error("No supported format found.")
    }

    const format = this.#getPreferredFormat(options.format, options.preferLowQuality)
    if (format === undefined) {
      throw new Error(`Unsupported format: ${options.format}`)
    }

    return format
  }

  #detectChannelCount(imageData) {
    let opaque = true
    let grayscale = true
    let invalidNormalCount = 0

    const count = Math.min(1024 * 128, imageData.length)
    for (let i = 0; i < count; i += 4) {
      const r = imageData[i] / 255
      const g = imageData[i + 1] / 255
      const b = imageData[i + 2] / 255
      const a = imageData[i + 3]

      if (a < 255) opaque = false
      if (r != g || g != b) grayscale = false

      const x = 2 * r - 1
      const y = 2 * g - 1
      const z = 2 * b - 1
      const len2 = x * x + y * y + z * z
      const len = Math.sqrt(len2)

      if (Math.abs(len - 1) > 0.2 || z < -0.1) invalidNormalCount += 1
    }

    if (!opaque) return 4
    if (grayscale) return 1
    if (4 * 4 * invalidNormalCount < count) return 2
    return 3
  }

  async #detectChannelCountGPU(texture) {
    const counterSize = 12 // 3 * 4 bytes (u32)

    // Create atomic counter buffer.
    const counterBuffer = this.#device.createBuffer({
      size: counterSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    })

    // Create a readback buffer.
    const readbackBuffer = this.#device.createBuffer({
      size: counterSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    })

    // Create bind group
    const bindGroup = this.#device.createBindGroup({
      layout: this.#detectChannelCountPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: texture.createView() },
        { binding: 1, resource: { buffer: counterBuffer } }
      ]
    })

    const encoder = this.#device.createCommandEncoder()

    // Dispatch compute shader
    const pass = encoder.beginComputePass()
    pass.setPipeline(this.#detectChannelCountPipeline)
    pass.setBindGroup(0, bindGroup)

    const { width, height } = texture
    const dispatchX = Math.ceil(width / 8)
    const dispatchY = Math.ceil(height / 8)
    pass.dispatchWorkgroups(dispatchX, dispatchY)
    pass.end()

    // Copy counter buffer to readback buffer
    encoder.copyBufferToBuffer(counterBuffer, 0, readbackBuffer, 0, counterSize)

    // Submit commands
    this.#device.queue.submit([encoder.finish()])

    // Wait for GPU to complete and read back results
    await this.#device.queue.onSubmittedWorkDone()

    await readbackBuffer.mapAsync(GPUMapMode.READ)
    const view = new Uint32Array(readbackBuffer.getMappedRange())
    const opaque = view[0] == 0
    const grayscale = view[1] == 0
    const invalidNormalCount = view[2]
    readbackBuffer.unmap()

    readbackBuffer.destroy()
    counterBuffer.destroy()

    if (!opaque) return 4
    if (grayscale) return 1
    if (4 * invalidNormalCount < width * height) return 2
    return 3
  }

  #updateUniformBuffer(colorMode, mipsAlphaScale, level) {
    // Get alpha scale for this mip level
    const alphaScale =
      mipsAlphaScale && mipsAlphaScale.length > 0
        ? level < mipsAlphaScale.length
          ? mipsAlphaScale[level]
          : mipsAlphaScale[mipsAlphaScale.length - 1]
        : 1.0

    const uniformData = new ArrayBuffer(8)
    const uniformDataView = new DataView(uniformData)
    uniformDataView.setUint32(0, colorMode, true)
    uniformDataView.setFloat32(4, alphaScale, true)

    this.#device.queue.writeBuffer(this.#uniformBuffer, 0, uniformData)
  }

  // Apply scaling and flipY transform.
  #processInputTexture(encoder, inputTexture, outputTexture, width, height, colorMode, flipY) {
    if (this.#useFragmentShader) {
      this.#processInputTextureFragmentShader(encoder, inputTexture, outputTexture, width, height, colorMode, flipY)
      return
    }

    this.#updateUniformBuffer(colorMode)

    const pass = encoder.beginComputePass()

    const pipeline = flipY ? this.#flipYPipeline : this.#resizePipeline

    pass.setPipeline(pipeline)

    const bindGroup = this.#device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: inputTexture.createView({
            baseMipLevel: 0,
            mipLevelCount: 1,
            format: (colorMode & ColorMode.sRGB) != 0 ? "rgba8unorm-srgb" : "rgba8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING
          })
        },
        {
          binding: 1,
          resource: outputTexture.createView({
            baseMipLevel: 0,
            mipLevelCount: 1,
            dimension: "2d",
            format: "rgba8unorm",
            usage: GPUTextureUsage.STORAGE_BINDING
          })
        },
        {
          binding: 2,
          resource: this.#defaultSampler
        },
        {
          binding: 3,
          resource: { buffer: this.#uniformBuffer }
        }
      ]
    })

    pass.setBindGroup(0, bindGroup)
    pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8))

    pass.end()
  }

  // Apply scaling and flipY transform.
  #processInputTextureFragmentShader(encoder, inputTexture, outputTexture, width, height, colorMode, flipY) {
    // In compat mode the texture is plain rgba8unorm with sRGBManual handling done in shader.
    const format = !this.#compatibilityMode && (colorMode & ColorMode.sRGB) != 0 ? "rgba8unorm-srgb" : "rgba8unorm"

    const dstView = outputTexture.createView({
      baseMipLevel: 0,
      mipLevelCount: 1,
      dimension: "2d",
      format: format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    })

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: dstView,
          loadOp: "clear",
          storeOp: "store",
          clearValue: [0, 0, 0, 0]
        }
      ]
    })

    this.#updateUniformBuffer(colorMode)

    const pipeline = flipY ? this.#flipYPipeline[format] : this.#resizePipeline[format]
    pass.setPipeline(pipeline)

    const bindGroup = this.#device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: inputTexture.createView({
            baseMipLevel: 0,
            mipLevelCount: 1,
            format: format,
            usage: GPUTextureUsage.TEXTURE_BINDING
          })
        },
        {
          binding: 2,
          resource: this.#defaultSampler
        },
        {
          binding: 3,
          resource: { buffer: this.#uniformBuffer }
        }
      ]
    })

    pass.setBindGroup(0, bindGroup)
    pass.draw(4, 1, 0, 0)

    pass.end()
  }

  async #generateMipmaps(encoder, texture, mipmapCount, width, height, colorMode, mipsAlphaScale, mipmapFilter) {
    if (mipsAlphaScale == undefined) this.#updateUniformBuffer(colorMode)

    let w = width
    let h = height
    if (this.#useFragmentShader) {
      for (let i = 0; i < mipmapCount - 1; i++) {
        if (mipsAlphaScale != undefined) this.#updateUniformBuffer(colorMode, mipsAlphaScale, i)

        w = Math.max(1, Math.floor(w / 2))
        h = Math.max(1, Math.floor(h / 2))
        this.#generateMipLevelFragmentShader(encoder, texture, i, i + 1, w, h, colorMode)
      }
    } else {
      const pass = encoder.beginComputePass()
      // The sharp mipmap filter causes fireflies when the filtered alpha is close to 0, so use box instead.
      const pipeline = mipmapFilter === "box" || (colorMode & ColorMode.Alpha) != 0 ? this.#mipmapPipeline : this.#magicMipmapPipeline
      const layout = pipeline.getBindGroupLayout(0)

      pass.setPipeline(pipeline)

      for (let i = 0; i < mipmapCount - 1; i++) {
        if (mipsAlphaScale != undefined) this.#updateUniformBuffer(colorMode, mipsAlphaScale, i)

        w = Math.max(1, Math.floor(w / 2))
        h = Math.max(1, Math.floor(h / 2))
        this.#generateMipLevel(pass, layout, texture, i, i + 1, w, h, colorMode)
      }

      pass.end()
    }
  }

  #generateMipLevel(pass, layout, texture, srcLevel, dstLevel, width, height, colorMode) {
    const bindGroup = this.#device.createBindGroup({
      layout: layout,
      entries: [
        {
          binding: 0,
          resource: texture.createView({
            baseMipLevel: srcLevel,
            mipLevelCount: 1,
            format: (colorMode & ColorMode.sRGB) != 0 ? "rgba8unorm-srgb" : "rgba8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING
          })
        },
        {
          binding: 1,
          resource: texture.createView({
            baseMipLevel: dstLevel,
            mipLevelCount: 1,
            dimension: "2d",
            format: "rgba8unorm",
            usage: GPUTextureUsage.STORAGE_BINDING
          })
        },
        {
          binding: 2,
          resource: this.#defaultSampler
        },
        {
          binding: 3,
          resource: { buffer: this.#uniformBuffer }
        }
      ]
    })

    pass.setBindGroup(0, bindGroup)
    pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8))
  }

  #generateMipLevelFragmentShader(encoder, texture, srcLevel, dstLevel, width, height, colorMode) {
    // In compat mode the texture is plain rgba8unorm and the mipmap fragment shader
    // applies sRGB conversion in shader via the sRGBManual bit.
    const format = !this.#compatibilityMode && (colorMode & ColorMode.sRGB) != 0 ? "rgba8unorm-srgb" : "rgba8unorm"
    const dstView = texture.createView({
      baseMipLevel: dstLevel,
      mipLevelCount: 1,
      dimension: "2d",
      format: format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    })

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: dstView,
          loadOp: "clear",
          storeOp: "store",
          clearValue: [0, 0, 0, 0]
        }
      ]
    })

    const bindGroup = this.#device.createBindGroup({
      layout: this.#mipmapPipeline[format].getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: texture.createView({
            baseMipLevel: srcLevel,
            mipLevelCount: 1,
            format: format,
            usage: GPUTextureUsage.TEXTURE_BINDING
          })
        },
        {
          binding: 2,
          resource: this.#defaultSampler
        },
        {
          binding: 3,
          resource: { buffer: this.#uniformBuffer }
        }
      ]
    })

    pass.setPipeline(this.#mipmapPipeline[format])
    pass.setBindGroup(0, bindGroup)
    pass.draw(4, 1, 0, 0)

    pass.end()
  }
}

export default Spark
