// Type definitions for @ludicon/spark.js
// Project: https://github.com/ludicon/spark.js
// Definitions by: Ludicon LLC

/**
 * Options for initializing Spark (WebGPU) encoder
 */
/**
 * Options controlling how temporary resources are cached across encodeTexture calls.
 */
export interface SparkCacheOptions {
  /**
   * Minimum width and height (in texels) that the cached block-level resources (render
   * targets and buffers) are allocated for, so that a sequence of encodes of increasing size
   * up to this value does not reallocate them. Encodes larger than this still grow the cache.
   * Does not apply to the cached source texture, which is only reused for images of exactly
   * the same size. Clamped to the device's maximum texture size.
   * @default 0 (size of the encode that triggers the allocation)
   */
  minSize?: number

  /**
   * Allocate the cached source texture with a full mip chain even when the encode that
   * triggers the allocation does not generate mipmaps. Avoids a reallocation the first time a
   * mipmapped encode of the same size is requested, at the cost of ~33% more memory.
   * @default false
   */
  allocateMipmaps?: boolean
}

export interface SparkCreateOptions {
  /**
   * Whether to preload all encoder pipelines or an array of format names to preload.
   * Pipelines that are not preloaded are compiled on-demand when first used.
   * @default false
   */
  preload?: boolean | string[]

  /**
   * Whether to cache temporary resources for reuse across encodeTexture calls.
   * Improves performance when encoding multiple textures, but uses more GPU memory.
   * Pass an object to enable caching and control how the resources are allocated.
   * @default false
   */
  cacheTempResources?: boolean | SparkCacheOptions

  /**
   * Enable verbose logging for debugging.
   * @default false
   */
  verbose?: boolean

  /**
   * Enable GPU timestamp queries for performance profiling.
   * Requires `timestamp-query` feature and enabling unsafe WebGPU features in the browser.
   * @default false
   */
  useTimestampQueries?: boolean
}

/**
 * Options for encoding textures with Spark
 */
export interface SparkEncodeOptions {
  /**
   * Desired block compression format. Can be specified in several ways:
   * - Channel mask: "r", "rg", "rgb", "rgba" - Auto-selects the best format based on device capabilities
   * - Explicit format: "bc1-rgb", "bc7-rgba", "astc-4x4-rgb", "etc2-rgb", "eac-r", etc.
   * - Substring: "bc1", "bc7", "astc", "etc2" - Chooses the first matching format
   * - Auto-detect: "auto" - Analyzes image to determine channel count (WebGPU only, has overhead)
   * @default "rgb"
   */
  format?: string

  /**
   * Hint for the automatic format selector. When the input format is "rgb" it chooses
   * 8 bit per block formats like "bc1" or "etc2" instead of "bc7" or "astc".
   * @default false
   */
  preferLowQuality?: boolean

  /**
   * Whether to generate mipmaps.
   * @default false
   */
  mips?: boolean

  /**
   * Alias for mips. Whether to generate mipmaps.
   * @default false
   */
  generateMipmaps?: boolean

  /**
   * Number of mip levels of the output texture. An explicit count is clamped to the full
   * chain down to 1x1. With `mips`, all of them are generated and encoded; without, only
   * level 0 is encoded and the other levels are left for later encodes with `outputTexture`
   * and `outputMipLevel`, for callers that provide their own mipmaps.
   *
   * @default the chain down to 4x4 with `mips`, otherwise 1
   */
  mipmapCount?: number

  /**
   * The filter to use for mipmap generation:
   * - "box" - Simple 2x2 box filter
   * - "magic" - Higher quality 4x4 filter with sharpening properties
   * @default "magic"
   */
  mipmapFilter?: "box" | "magic"

  /**
   * Optional array of alpha scale values to apply to each generated mipmap level.
   * The array should contain one value per mipmap level (starting with mip level 1).
   * Each value multiplies the alpha channel of the corresponding mipmap level.
   * Values greater than 1.0 increase opacity, while values less than 1.0 increase transparency.
   * If the array is shorter than the number of mipmap levels, the last value is used for remaining levels.
   * Only applies when mips is true.
   */
  mipsAlphaScale?: number[]

  /**
   * Whether to encode the image using an sRGB format.
   * This also affects mipmap generation. The srgb mode can also be inferred from the format.
   * @default false
   */
  srgb?: boolean

  /**
   * Whether to interpret the image as a normal map.
   * This affects automatic format selection favoring the use of "bc5" and "eac-rg" formats.
   * @default false
   */
  normal?: boolean

  /**
   * Whether to vertically flip the image before encoding.
   * @default false
   */
  flipY?: boolean

  /**
   * An existing texture to write the result into instead of allocating a new one.
   *
   * - For Spark: a `GPUTexture` (it must have `COPY_DST` usage).
   * - For SparkGL: a previous `encodeTexture()` result, or any object describing the
   *   texture (see `SparkGLOutputTexture`).
   *
   * Without `outputMipLevel` the texture is a hint: it is reused only when its width, height,
   * mipmap count and format match the encode exactly (for example when re-encoding video
   * frames), otherwise a fresh texture is allocated and returned. With `outputMipLevel` it is
   * a requirement, see below.
   */
  outputTexture?: GPUTexture | SparkGLOutputTexture

  /**
   * Mip level of `outputTexture` that receives level 0 of the encode; the generated mipmaps
   * follow at the next levels. Use it to fill one mip chain in several passes, for example a
   * small preview into the lower levels first and the full-resolution image into level 0
   * later, or one caller-provided mipmap per call. Levels outside the encode are left untouched.
   *
   * When specified (even as 0), `outputTexture` is required and validated: its level
   * `outputMipLevel` must have the size of the encode, it must have room for all the encoded
   * levels, and its format must match. A mismatch throws.
   *
   * @default undefined (level 0, with `outputTexture` treated as a hint)
   */
  outputMipLevel?: number
}

/**
 * WebGPU-based texture encoder
 */
export class Spark {
  /**
   * Creates a new Spark instance for WebGPU.
   * @param device - WebGPU device with required features enabled
   * @param options - Configuration options
   * @returns Initialized Spark instance
   */
  static create(device: GPUDevice, options?: SparkCreateOptions): Promise<Spark>

  /**
   * Determines the set of WebGPU features to request when initializing the device.
   * This function inspects the given adapter to see which texture compression and shader
   * features are available, and returns a list of those that are both supported and safe to enable.
   * @param adapter - The WebGPU adapter returned from navigator.gpu.requestAdapter()
   * @returns Array of WebGPU feature names to request during adapter.requestDevice()
   */
  static getRequiredFeatures(adapter: GPUAdapter): GPUFeatureName[]

  /**
   * Destroys the Spark instance and all associated GPU resources.
   */
  dispose(): void

  /**
   * Load an image and encode it to a compressed GPU texture.
   * @param source - The image to encode. Can be a URL string, DOM image element, ImageBitmap, HTMLCanvasElement, OffscreenCanvas, VideoFrame, or GPUTexture
   * @param options - Optional configuration for encoding
   * @returns Promise resolving to the encoded GPU texture
   */
  encodeTexture(
    source: string | Blob | HTMLImageElement | ImageBitmap | HTMLCanvasElement | OffscreenCanvas | VideoFrame | GPUTexture,
    options?: SparkEncodeOptions
  ): Promise<GPUTexture>

  /**
   * Returns list of compression formats supported on the current device.
   * @returns Array of format name strings (e.g., "bc7-rgba", "bc1-rgb", "etc2-rgb")
   */
  getSupportedFormats(): string[]

  /**
   * Checks if a specific format is supported.
   * @param format - Format name or format constant
   * @returns True if format is supported
   */
  isFormatSupported(format: string | number): boolean

  /**
   * Frees cached temporary GPU resources when cacheTempResources option is enabled.
   * Call this when you're done encoding textures to free up GPU memory.
   */
  freeTempResources(): void

  /**
   * Try to determine the best compression options automatically.
   * Do not use this in production, this is for convenience only.
   * @param source - Image input
   * @param options - Encoding options
   * @returns Recommended encoding options with an explicit encoding format
   */
  selectPreferredOptions(
    source: string | Blob | HTMLImageElement | ImageBitmap | HTMLCanvasElement | OffscreenCanvas | VideoFrame | GPUTexture,
    options?: SparkEncodeOptions
  ): Promise<SparkEncodeOptions>

  /**
   * Get elapsed time for the last encoding operation (requires useTimestampQueries option).
   * @returns Promise resolving to elapsed time in milliseconds
   */
  getTimeElapsed(): Promise<number>
}

/**
 * Options for initializing SparkGL (WebGL2) encoder
 */
export interface SparkGLCreateOptions {
  /**
   * Whether to preload shader programs. Can be:
   * - false: Load shaders on-demand
   * - true: Preload all supported formats
   * - string[]: Array of format names to preload (e.g., ["bc7", "astc"])
   * @default false
   */
  preload?: boolean | string[]

  /**
   * Whether to cache temporary resources for reuse across encodeTexture calls.
   * Pass an object to enable caching and control how the resources are allocated.
   * @default false
   */
  cacheTempResources?: boolean | SparkCacheOptions

  /**
   * Enable verbose logging for debugging.
   * @default false
   */
  verbose?: boolean

  /**
   * Enable WebGL shader validation. Only enable this for debugging,
   * as it disables async shader compilation.
   * @default false
   */
  validateShaders?: boolean
}

/**
 * A WebGL texture to encode, with its size (WebGL cannot query it). Only level 0 is read;
 * mipmaps are generated by Spark when requested. Store sRGB data in a non-sRGB format such as
 * RGBA8, as for image sources. With `flipY` or mipmaps the texture is copied first and must be
 * color-renderable; otherwise it is encoded in place and only its TEXTURE_BASE_LEVEL is
 * temporarily changed.
 */
export interface SparkGLInputTexture {
  texture: WebGLTexture
  width: number
  height: number
}

/**
 * Description of a WebGL texture that SparkGL.encodeTexture() can write into. WebGL cannot
 * query these from the texture handle, so the caller provides them. Every encodeTexture()
 * result satisfies this interface.
 */
export interface SparkGLOutputTexture {
  /**
   * The compressed WebGL texture
   */
  texture: WebGLTexture

  /**
   * WebGL internal format constant the texture storage was allocated with
   */
  format: number

  /**
   * Texture width in pixels
   */
  width: number

  /**
   * Texture height in pixels
   */
  height: number

  /**
   * Number of mipmap levels allocated
   */
  mipmapCount: number
}

/**
 * Result object returned by SparkGL.encodeTexture(). It always describes the whole texture,
 * which may be larger than the encode when writing into a caller-supplied `outputTexture`.
 */
export interface SparkGLTextureResult extends SparkGLOutputTexture {
  /**
   * Human-readable Spark format name
   */
  sparkFormat: string

  /**
   * Whether the texture is encoded in an sRGB format
   */
  srgb: boolean

  /**
   * Number of bytes written by this call
   */
  byteLength: number
}

/**
 * WebGL2-based texture encoder
 */
export class SparkGL {
  /**
   * Creates a new SparkGL instance for WebGL2.
   * @param gl - WebGL2 context. Required extensions are automatically enabled.
   * @param options - Configuration options
   * @returns Initialized SparkGL instance
   */
  static create(gl: WebGLRenderingContext | WebGL2RenderingContext, options?: SparkGLCreateOptions): SparkGL

  /**
   * Destroys the SparkGL instance and all associated GPU resources.
   * Resolves once any programs still being compiled have been deleted.
   */
  dispose(): Promise<void>

  /**
   * Load an image and encode it to a compressed WebGL texture.
   * @param source - The image to encode. Can be a URL string, DOM image element, ImageBitmap, HTMLCanvasElement, OffscreenCanvas, or a SparkGLInputTexture describing a WebGL texture
   * @param options - Optional configuration for encoding
   * @returns Promise resolving to an object containing the encoded texture and metadata
   */
  encodeTexture(
    source: string | Blob | HTMLImageElement | ImageBitmap | HTMLCanvasElement | OffscreenCanvas | VideoFrame | SparkGLInputTexture,
    options?: SparkEncodeOptions
  ): Promise<SparkGLTextureResult>

  /**
   * Returns list of compression formats supported on the current device.
   * @returns Array of format name strings (e.g., "bc7-rgba", "bc1-rgb", "etc2-rgb")
   */
  getSupportedFormats(): string[]

  /**
   * Checks if a specific format is supported.
   * @param format - Format name or format constant
   * @returns True if format is supported
   */
  isFormatSupported(format: string | number): boolean

  /**
   * Frees cached temporary GPU resources when cacheTempResources option is enabled.
   * Call this when you're done encoding textures to free up GPU memory.
   */
  freeTempResources(): void
}

export default Spark
