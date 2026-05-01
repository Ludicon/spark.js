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
|-------------------|---------------------------------------|-----------------------------------------|
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
  - `cacheTempResources` (`boolean`, default: `false`) - Whether to cache temporary resources for reuse across `encodeTexture` calls. Improves performance when encoding multiple textures, but uses more GPU memory.
  - `verbose` (`boolean`, default: `false`) - Enable verbose logging for debugging.
  - `useTimestampQueries` (`boolean`, default: `false`) - Enable GPU timestamp queries for performance profiling (requires `timestamp-query` feature and enabling unsafe WebGPU features in the browser).

**Returns:** `Promise<Spark>` - Initialized Spark instance.

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
  - `cacheTempResources` (`boolean`, default: `false`) - Whether to cache temporary resources for reuse across `encodeTexture` calls.
  - `verbose` (`boolean`, default: `false`) - Enable verbose logging for debugging.
  - `validateShaders` (`boolean`, default: `false`) - Enable WebGL shader validation. Only enable thsi for debuggigng, as it disables async shader compilation.

**Returns:** `SparkGL` - Initialized SparkGL instance.

---

## Core Methods

### `encodeTexture(source, options)`

Loads an image and encodes it to a compressed GPU texture.

**Parameters:**

- **`source`** (`string | HTMLImageElement | ImageBitmap | HTMLCanvasElement | OffscreenCanvas | VideoFrame | GPUTexture | WebGLTexture`)  
  The image to encode. Can be:
  - URL string (loads image automatically)
  - DOM `<img>` element
  - `ImageBitmap` object
  - `HTMLCanvasElement`
  - `OffscreenCanvas`
  - `VideoFrame`
  - `GPUTexture` (WebGPU only)
  - `WebGLTexture` (WebGL only)

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

**Returns:**

- **Spark (WebGPU)**: `Promise<GPUTexture>` - A promise resolving to the encoded WebGPU texture.
- **SparkGL (WebGL2)**: `Promise<Object>` - A promise resolving to an object with properties:
  - `texture` (`WebGLTexture`) - The compressed WebGL texture
  - `format` (`number`) - WebGL internal format constant
  - `sparkFormat` (`string`) - Spark format name
  - `width` (`number`) - Texture width
  - `height` (`number`) - Texture height
  - `mipLevels` (`number`) - Number of mipmap levels
  - `byteLength` (`number`) - Size of the texture data in bytes


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

**Example:**

```js
spark.dispose()
```

---

## Format Selection

### Supported Formats

spark.js only offers a subset of the formats supported by Spark, but provides enough coverage for most use cases.

| Format    | Channels | Bytes/Block | Compression Ratio | Quality |
|-----------|----------|-------------|-------------------|---------|
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
await spark.encodeTexture(image, { format: "rgba" })  // Auto-selects BC7/ASTC/ETC2
await spark.encodeTexture(image, { format: "rgb" })   // Auto-selects BC7/ASTC/BC1/ETC2
await spark.encodeTexture(image, { format: "rg" })    // Auto-selects BC5/EAC-RG
await spark.encodeTexture(image, { format: "r" })     // Auto-selects BC4/EAC-R
```

#### 3. Auto-Detection

```js
await spark.encodeTexture(image, { format: "auto" })  // Analyzes image
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

Enable resource caching for batch encoding:

```js
const spark = await Spark.create(device, { cacheTempResources: true })

const textures = await Promise.all(
  imageUrls.map(url => spark.encodeTexture(url, options))
)
// Free cached resources
spark.freeTempResources()
```

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
