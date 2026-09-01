# spark.js API Documentation

This document describes the API for both `Spark` (WebGPU) and `SparkGL` (WebGL2) classes. Both classes share nearly identical APIs, with only minor differences in initialization and return types.

## Table of Contents

- [Overview](#overview)
- [Initialization](#initialization)
- [Core Methods](#core-methods)
- [Format Selection](#format-selection)
- [Advanced Usage](#advanced-usage)

---

## Overview

`spark.js` provides two main classes:

- **`Spark`** - WebGPU-based encoder
- **`SparkGL`** - WebGL2-based encoder

Both classes provide the same encoding API and options with some minor differences. The primary differences are:

| Feature           | Spark (WebGPU)                        | SparkGL (WebGL2)                        |
| ----------------- | ------------------------------------- | --------------------------------------- |
| Initialization    | `async Spark.create(device, options)` | `SparkGL.create(gl, options)`           |
| `encodeTexture()` | Returns `GPUTexture`                  | Returns object with `.texture` property |

### Core Methods

- [`encodeTexture(source, options)`](#encodetexturesource-options--promisegputexture-spark-or-promisetexture-format--sparkgl) - Load and encode an image to a compressed GPU texture
- [`getSupportedFormats()`](#getsupportedformats--string) - Get list of supported compression formats
- [`isFormatSupported(format)`](#isformatsupportedformat--boolean) - Check if a specific format is supported
- [`freeTempResources()`](#freetempresources) - Free cached temporary GPU resources

---

## Initialization

### WebGPU

```js
import { Spark } from "@ludicon/spark.js"

// Get required features for spark.js
const adapter = await navigator.gpu.requestAdapter()
const requiredFeatures = Spark.getRequiredFeatures(adapter)

// Create device with required features
const device = await adapter.requestDevice({ requiredFeatures })

// Create spark instance
const spark = await Spark.create(device, options)
```

#### `Spark.create(device, options)`

Creates a new Spark instance for WebGPU.

**Parameters:**

- `device` (`GPUDevice`) - WebGPU device with required features enabled
- `options` (`Object`, optional) - Configuration options:
  - `preload` (`boolean` or `string[]`, default: `false`) - Whether to preload all or a subset of the encoder pipelines. Pipelines that are not preloaded are compiled on-demand when first used.
  - `cacheTempResources` (`boolean` or `object`, default: `false`) - Whether to cache temporary resources for reuse across `encodeTexture` calls. Cached resources grow to fit the largest encode and are freed by `freeTempResources()` or `dispose()`. Improves performance when encoding multiple textures. Pass an object to enable caching and control the allocation (see [Resource Caching](#resource-caching)).
  - `verbose` (`boolean`, default: `false`) - Enable verbose logging for debugging.
  - `useTimestampQueries` (`boolean`, default: `false`) - Enable GPU timestamp queries for performance profiling (requires `timestamp-query` feature and enabling unsafe WebGPU features in the browser).

**Returns:** `Promise<Spark>` - Initialized Spark instance.

Compatibility-mode codepaths are auto-enabled when the device doesn't expose the `"core-features-and-limits"` feature.

#### `Spark.getRequiredFeatures(adapter)` → `string[]`

Static method that inspects a WebGPU adapter and returns the list of features required by spark.js.

**Parameters:**

- `adapter` (`GPUAdapter`) - WebGPU adapter from `navigator.gpu.requestAdapter()`

**Returns:** `string[]` - Array of feature names to request (e.g., `["texture-compression-bc", "texture-compression-astc"]`)

### WebGL2

```js
import { SparkGL } from "@ludicon/spark.js"

// Create WebGL2 context
const canvas = document.createElement("canvas")
const gl = canvas.getContext("webgl2")

// Create spark instance
const spark = SparkGL.create(gl, options)
```

#### `SparkGL.create(gl, options)`

Creates a new SparkGL instance for WebGL2.

**Parameters:**

- `gl` (`WebGL2RenderingContext`) - WebGL2 context. Required extensions are automatically enabled.
- `options` (`Object`, optional) - Configuration options:
  - `preload` (`boolean` or `string[]`, default: `false`) - Whether to preload shader programs. Can be:
    - `false` - Load shaders on-demand
    - `true` - Preload all supported formats
    - `string[]` - Array of format names to preload (e.g., `["bc7", "astc"]`)
  - `cacheTempResources` (`boolean` or `object`, default: `false`) - Whether to cache temporary resources for reuse across `encodeTexture` calls. Cached resources grow to fit the largest encode and are freed by `freeTempResources()` or `dispose()`. Improves performance when encoding multiple textures. Pass an object to enable caching and control the allocation (see [Resource Caching](#resource-caching)).
  - `verbose` (`boolean`, default: `false`) - Enable verbose logging for debugging.
  - `validateShaders` (`boolean`, default: `false`) - Enable WebGL shader validation. Only enable thsi for debuggigng, as it disables async shader compilation.

**Returns:** `SparkGL` - Initialized SparkGL instance.

---

## Core Methods

### `encodeTexture(source, options)`

Loads an image and encodes it to a compressed GPU texture.

**Parameters:**

- **`source`** (`string | Blob | HTMLImageElement | ImageBitmap | HTMLCanvasElement | OffscreenCanvas | VideoFrame | GPUTexture | { texture: WebGLTexture, width, height }`)  
  The image to encode. Can be:
  - URL string (loads image automatically)
  - `Blob` (encoded image bytes; decoded internally via `ImageDecoder` when supported, else `createImageBitmap`)
  - DOM `<img>` element
  - `ImageBitmap` object
  - `HTMLCanvasElement`
  - `OffscreenCanvas`
  - `VideoFrame`
  - `GPUTexture` (WebGPU only)
  - `{ texture: WebGLTexture, width, height }` (WebGL only) - A WebGL texture with its size, since WebGL cannot query it. Only level 0 is read; mipmaps are generated by Spark when requested. Store sRGB data in a non-sRGB format such as `RGBA8`, as for image sources. With `flipY` or mipmaps the texture is copied first and must be color-renderable; otherwise it is encoded in place and only its `TEXTURE_BASE_LEVEL` is temporarily changed.

- **`options`** (`Object`, optional)
  Configuration options for encoding:
  - **`format`** (`string`)
    Desired block compression format. The format can be specified in several different ways:
    - **Channel mask**: `"r"`, `"rg"`, `"rgb"`, `"rgba"` - Auto-selects the best format based on device capabilities.

    - **Explicit format**: An explicit format name: `"bc1-rgb"`, `"bc7-rgba"`, `"astc-4x4-rgb"`, `"etc2-rgb"`, `"eac-r"`, etc. See the [Supported Formats](#supported-formats)) for a list of supported formats.

    - **Substring**: `"bc1"`, `"bc7"`, `"astc"`, `"etc2"`, etc. - Chooses the first matching format.

    - **Auto-detect**: `"auto"` - Analyzes image to determine the channel count. This is available in WebGPU only and has some overhead. It's always recommended to specify the format through one of the other methods.

    Default: `rgb`.

  - **`preferLowQuality`** (`boolean`)
    Hint for the automatic format selector. When the input format is `"rgb"` it chooses 8 bit per block formats like `"bc1"` or `"etc2"` instead of `"bc7"` or `"astc"`. Default: `false`.

  - **`mips`** or **`generateMipmaps`** (`boolean`)
    Whether to generate mipmaps. Default: `false`.

  - **`mipmapCount`** (`number`)
    Number of mip levels of the output texture. With `mips`, all of them are generated and encoded; without, only level 0 is encoded and the other levels are left for later encodes with `outputTexture` and `outputMipLevel` (see [Progressive Loading](#progressive-loading)). An explicit count is clamped to the full chain down to 1×1. Default: the chain down to 4×4 with `mips`, otherwise `1`.

  - **`mipmapFilter`** (`string`)
    The filter to use for mipmap generation:
    - `"box"` - Simple 2x2 box filter
    - `"magic"` - Higher quality 4x4 filter with sharpening properties.
      Default: `"magic"`.

  - **`mipsAlphaScale`** (`number[]`)
    Optional array of alpha scale values to apply to each generated mipmap level. The array should contain one value per mipmap level (starting with mip level 1, since level 0 is the base image). Each value multiplies the alpha channel of the corresponding mipmap level. Values greater than 1.0 increase opacity, while values less than 1.0 increase transparency. This is useful for techniques like alpha-tested mipmaps where you want to compensate for alpha loss at lower mip levels. If the array is shorter than the number of mipmap levels, the last value is used for remaining levels. Only applies when `mips` is `true`. Default: `undefined` (no scaling applied).

  - **`srgb`** (`boolean`)
    Whether to encode the image using an as sRGB format. This also affects mipmap generation. The `srgb` mode can also be inferred from the `format`. Default: `false`.

  - **`normal`** (`boolean`)
    Whether to interpret the image as a normal map. This affects automatic format selection favoring the use of `"bc5"` and `"eac-rg"` formats. Default: `false`.

  - **`flipY`** (`boolean`)
    Whether to vertically flip the image before encoding. Default: `false`.

  - **`outputTexture`** (`GPUTexture` for Spark, texture description for SparkGL)
    An existing texture to write the result into instead of allocating a new one. For Spark pass a `GPUTexture` with `COPY_DST` usage; for SparkGL pass a previous result object, or any object with the same `texture`, `width`, `height`, `mipmapCount` and `format` properties. Without `outputMipLevel` the texture is a hint: it is reused only when its width, height, mipmap count, and format match the resolved output exactly, otherwise a fresh texture is allocated and returned. Useful for real-time use cases such as encoding successive video frames. Default: `undefined`.

  - **`outputMipLevel`** (`number`)
    Mip level of `outputTexture` that receives level 0 of the encode; generated mipmaps follow at the next levels and other levels are left untouched. When specified (even as `0`), `outputTexture` is required and validated: its level `outputMipLevel` must have the size of the encode, it must have room for all encoded levels, and its format must match, otherwise `encodeTexture` throws. See [Progressive Loading](#progressive-loading). Default: `undefined`.

**Returns:**

- **Spark (WebGPU)**: `Promise<GPUTexture>` - A promise resolving to the encoded WebGPU texture.
- **SparkGL (WebGL2)**: `Promise<Object>` - A promise resolving to an object with properties:
  - `texture` (`WebGLTexture`) - The compressed WebGL texture
  - `format` (`number`) - WebGL internal format constant
  - `sparkFormat` (`string`) - Human-readable Spark format name
  - `srgb` (`boolean`) - Whether the texture is encoded in an sRGB format
  - `width` (`number`) - Texture width
  - `height` (`number`) - Texture height
  - `mipmapCount` (`number`) - Number of mipmap levels
  - `byteLength` (`number`) - Number of bytes written by this call

  The result always describes the whole texture. When writing into a caller-supplied `outputTexture`, `texture`, `width`, `height` and `mipmapCount` are those of the supplied texture, and the result can be passed back as `outputTexture` to a later call.

### `getSupportedFormats()`

Returns list of compression formats supported on the current device.

**Returns:** `string[]` - Array of format name strings

**Example:**

```js
const formats = spark.getSupportedFormats()
// ["bc7-rgba", "bc1-rgb", "etc2-rgb", ...]
```

### `isFormatSupported(format)`

Checks if a specific format is supported.

**Parameters:**

- `format` (`string | number`) - Format name or format constant

**Returns:** `boolean` - True if format is supported

**Example:**

```js
if (spark.isFormatSupported("bc7-rgba")) {
  // Use BC7
}
```

### `freeTempResources()`

Frees cached temporary GPU resources when `cacheTempResources` option is enabled.

**Example:**

```js
// Encode multiple textures with caching
const spark = await Spark.create(device, { cacheTempResources: true })

for (const url of imageUrls) {
  await spark.encodeTexture(url, options)
}

// Free cached resources when done
spark.freeTempResources()
```

### `dispose()`

Destroys the Spark instance and all associated GPU resources.

For `SparkGL`, `dispose()` is asynchronous and resolves once any programs still being compiled have been deleted. Awaiting it is optional.

**Example:**

```js
spark.dispose()
```

---

## Format Selection

### Supported Formats

spark.js only offers a subset of the formats supported by Spark, but provides enough coverage for most use cases.

| Format    | Channels | Bytes/Block | Compression Ratio | Quality |
| --------- | -------- | ----------- | ----------------- | ------- |
| bc1-rgb   | RGB      | 8           | 8:1               | Low     |
| bc4-r     | R        | 8           | 2:1               | High    |
| bc5-rg    | RG       | 8           | 2:1               | High    |
| bc7-rgb   | RGB      | 16          | 4:1               | High    |
| bc7-rgba  | RGBA     | 16          | 4:1               | High    |
| etc2-rgb  | RGB      | 8           | 8:1               | Low     |
| eac-r     | R        | 8           | 2:1               | High    |
| eac-rg    | RG       | 16          | 2:1               | High    |
| astc-rgb  | RGB      | 16          | 4:1               | High    |
| astc-rgba | RGBA     | 16          | 4:1               | High    |

### Format Selection Strategies

#### 1. Explicit Format

```js
await spark.encodeTexture(image, { format: "bc7-rgba" })
```

#### 2. Channel Mask (Recommended)

```js
await spark.encodeTexture(image, { format: "rgba" }) // Auto-selects BC7/ASTC/ETC2
await spark.encodeTexture(image, { format: "rgb" }) // Auto-selects BC7/ASTC/BC1/ETC2
await spark.encodeTexture(image, { format: "rg" }) // Auto-selects BC5/EAC-RG
await spark.encodeTexture(image, { format: "r" }) // Auto-selects BC4/EAC-R
```

#### 3. Auto-Detection

```js
await spark.encodeTexture(image, { format: "auto" }) // Analyzes image
```

---

## Advanced Usage

### Preloading Formats

Precompile encoders for faster first-time encoding:

```js
// preload codecs for all supported formats
const spark = await Spark.create(device, { preload: true })

// preload codecs for specific formats
const spark = SparkGL.create(gl, { preload: ["rgb", "rg", "r"] })
```

### Resource Caching

Each `encodeTexture()` call needs a few temporary GPU resources: a copy of the source image (with mipmaps, if requested), an intermediate buffer or render target for the encoded blocks, and a readback buffer. By default these are allocated and freed on every call. When encoding many textures, enable `cacheTempResources` to keep them alive across calls:

```js
const spark = await Spark.create(device, { cacheTempResources: true })

const textures = await Promise.all(imageUrls.map(url => spark.encodeTexture(url, options)))
// Free cached resources
spark.freeTempResources()
```

Cached resources are allocated lazily, the first time an encode needs them, and are sized by that encode. The block-level resources (render targets and buffers) are reused by any encode that fits in them and reallocated by a larger one. The source texture is only reused by images of exactly the same size: the mipmap generator and the encoders read the whole texture, so a larger one would bleed the previous image into the edges and mipmaps of the new one. All cached resources are released by `freeTempResources()` or `dispose()`.

#### Sizing the cache

Because the cache only grows on demand, a sequence of encodes of increasing size (for example 64, 128, 256, 512) reallocates the block-level resources at every step. To avoid this, pass an object instead of `true` to control how the cached resources are allocated. Both fields are optional and behave the same in `Spark` and `SparkGL`:

```js
const spark = await Spark.create(device, {
  cacheTempResources: { minSize: 2048, allocateMipmaps: true }
})
```

- `minSize` (`number`, default: `0`) - Minimum width and height, in texels, that the block-level resources are allocated for. With `minSize: 512` the sequence above allocates them once, on the first encode. Encodes larger than `minSize` still grow the cache. The value is clamped to the device's maximum texture size. It does not apply to the source texture, for the reason given above.
- `allocateMipmaps` (`boolean`, default: `false`) - Allocate the cached source texture with a full mip chain even if the encode that triggers the allocation does not generate mipmaps. By default the chain is only allocated when the triggering encode requests mipmaps, so callers that never use mipmaps (for example tile renderers) don't pay for it. Callers that mix mipmapped and non-mipmapped encodes of the same size can set this to avoid a reallocation the first time mipmaps are requested.

Memory cost for `minSize = N` is roughly `(N/4)² × 16` bytes per block render target or output buffer, i.e. 16 MB for `N = 4096`. The source texture costs `width × height × 4` bytes (×4/3 with mipmaps) for the last encoded size.

### Progressive Loading

`outputTexture`, `outputMipLevel` and `mipmapCount` let several encodes fill one mip chain, so that a texture can be shown at low resolution first and refined in place, without swapping textures. For example, a viewer can encode a small preview into the lower levels of the final texture, sample only those levels while the full-resolution image loads, and then fill the top levels:

```js
// Allocate the final 4096² chain (spark generates mipmaps down to 4×4, i.e. 11 levels),
// then encode the 256² preview into its level 4.
const pyramid = device.createTexture({
  size: [4096, 4096],
  mipLevelCount: 11,
  format: "bc7-rgba-unorm-srgb",
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
})
await spark.encodeTexture(preview, { format: "bc7", srgb: true, mips: true, outputTexture: pyramid, outputMipLevel: 4 })
// ...render with the sampler's lodMinClamp at 4, then:
await spark.encodeTexture(fullImage, { format: "bc7", srgb: true, mips: true, outputTexture: pyramid, outputMipLevel: 0 })
```

With SparkGL, allocate the texture with `texStorage2D` and describe it the same way `encodeTexture` returns it:

```js
const outputTexture = { texture, width: 4096, height: 4096, mipmapCount: 11, format: gl.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT }
await spark.encodeTexture(preview, { format: "bc7", srgb: true, mips: true, outputTexture, outputMipLevel: 4 })
```

The encode at level `n` must have the size of that level (`max(1, width >> n)` × `max(1, height >> n)`), and the texture must have room for all the levels the encode writes below it. The second pass above re-encodes the lower levels from the full-resolution image, which gives a better chain than the preview; to write only the top levels instead, limit the chain with `mipmapCount: 4`. Spark never changes the sampler state of a texture it did not allocate, so `TEXTURE_BASE_LEVEL`, filters and wrap modes set by the caller are preserved.

The same options let a caller provide its own mipmaps. The first encode allocates the whole chain but, without `mips`, writes only level 0; each following encode writes one level:

```js
const texture = await spark.encodeTexture(levels[0], { format: "bc7", mipmapCount: levels.length })
for (let level = 1; level < levels.length; level++) {
  await spark.encodeTexture(levels[level], { format: "bc7", outputTexture: texture, outputMipLevel: level })
}
```

Until they are written, the unencoded levels of a freshly allocated texture read as zero. (With SparkGL, pass the first result object as `outputTexture`.)

### Verbose Logging

Enable detailed logging for debugging:

```js
const spark = await Spark.create(device, { verbose: true })
// Logs encoding times, format selection, etc.
```

### Performance Profiling (WebGPU)

Use timestamp queries to measure GPU performance:

```js
const spark = await Spark.create(device, {
  useTimestampQueries: true,
  verbose: true
})
// GPU timings logged to console
```
