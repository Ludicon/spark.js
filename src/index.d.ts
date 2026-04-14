// Type definitions for @ludicon/spark.js
// Project: https://github.com/ludicon/spark.js
// Definitions by: Ludicon LLC

/**
 * Options for initializing Spark (WebGPU) encoder
 */
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
   * @default false
   */
  cacheTempResources?: boolean

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
   * @param source - The image to encode. Can be a URL string, DOM image element, ImageBitmap, HTMLCanvasElement, OffscreenCanvas, or GPUTexture
   * @param options - Optional configuration for encoding
   * @returns Promise resolving to the encoded GPU texture
   */
  encodeTexture(source: string | HTMLImageElement | ImageBitmap | HTMLCanvasElement | OffscreenCanvas | GPUTexture, options?: SparkEncodeOptions): Promise<GPUTexture>

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
  selectPreferredOptions(source: string | HTMLImageElement | ImageBitmap | HTMLCanvasElement | OffscreenCanvas | GPUTexture, options?: SparkEncodeOptions): Promise<SparkEncodeOptions>

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
   * @default false
   */
  cacheTempResources?: boolean

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
 * Result object returned by SparkGL.encodeTexture()
 */
export interface SparkGLTextureResult {
  /**
   * The compressed WebGL texture
   */
  texture: WebGLTexture

  /**
   * WebGL internal format constant
   */
  format: number

  /**
   * Spark format name
   */
  sparkFormat: number

  /**
   * Human-readable Spark format name
   */
  sparkFormatName: string

  /**
   * Texture width in pixels
   */
  width: number

  /**
   * Texture height in pixels
   */
  height: number

  /**
   * Number of mipmap levels
   */
  mipLevels: number

  /**
   * Size of the texture data in bytes
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
   */
  dispose(): void

  /**
   * Load an image and encode it to a compressed WebGL texture.
   * @param source - The image to encode. Can be a URL string, DOM image element, ImageBitmap, HTMLCanvasElement, OffscreenCanvas, or WebGLTexture
   * @param options - Optional configuration for encoding
   * @returns Promise resolving to an object containing the encoded texture and metadata
   */
  encodeTexture(source: string | HTMLImageElement | ImageBitmap | HTMLCanvasElement | OffscreenCanvas | WebGLTexture, options?: SparkEncodeOptions): Promise<SparkGLTextureResult>

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
