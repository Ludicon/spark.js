# spark.js⚡️

[![npm version](https://img.shields.io/npm/v/@ludicon/spark.js.svg)](https://www.npmjs.com/package/@ludicon/spark.js) [![install size](https://packagephobia.com/badge?p=@ludicon/spark.js)](https://packagephobia.com/result?p=@ludicon/spark.js) [![WebGPU](https://img.shields.io/badge/WebGPU-supported-green.svg)](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) [![WebGL2](https://img.shields.io/badge/WebGL2-supported-blue.svg)](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)

Real-time texture compression library for the Web.

[*spark.js*](https://ludicon.com/sparkjs) is a standalone JavaScript library that exposes a subset of the [*Spark*](https://ludicon.com/spark) codecs through a simple and lightweight API.

It enables the use of standard image formats in WebGL and WebGPU applications transcoding them at load-time to native GPU formats like BC7, ASTC, and ETC2, using fast, high-quality GPU encoders.

Try the [image viewer](https://ludicon.com/sparkjs/viewer/) or the [gltf demo](https://ludicon.com/sparkjs/gltf-demo/):

[<img src="https://ludicon.com/sparkjs/viewer/og.jpg" width="49%">](https://ludicon.com/sparkjs/viewer/) [<img src="https://ludicon.com/sparkjs/gltf-demo/og.jpg" width="49%">](https://ludicon.com/sparkjs/gltf-demo/)
[<img src="https://ludicon.com/sparkjs/tiles-demo/tiles-card.jpg" width="49%">](https://ludicon.github.io/spark.js/three-3d-tiles.html)

---

## Installation

```bash
npm install @ludicon/spark.js
```

## WebGPU Usage Example

```js
import { Spark } from "@ludicon/spark.js"

// Initialize a WebGPU device with required features
const adapter = await navigator.gpu.requestAdapter()
const requiredFeatures = Spark.getRequiredFeatures(adapter)
const device = await adapter.requestDevice({ requiredFeatures })

// Create spark instance for the WebGPU device
const spark = await Spark.create(device)

// Load and encode an image into a GPU texture
const texture = await spark.encodeTexture("image.avif")
```

The main entry point is `spark.encodeTexture()`, which loads an image and transcodes it into a compressed `GPUTexture` using the selected format and options. The example above uses default settings, but `encodeTexture` supports additional parameters for mipmap generation, sRGB encoding, normal map processing, and more.

If the input image dimensions are not multiples of the block size, it will be resized to meet GPU format requirements. For best results, use images with dimensions that are multiples of 4.

## WebGL Usage Example

```js
import { SparkGL } from "@ludicon/spark.js"

// Initialize a WebGL2 context with required extensions
const canvas = document.createElement("canvas")
const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true })

// Create spark instance for the WebGL2 context
const spark = await SparkGL.create(gl)

// Load and encode an image into a WebGL texture
const texture = await spark.encodeTexture("image.avif").texture
```

The main difference is the use of the `SparkGL` class instead of `Spark`. The API of the `spark` object is the same, but `spark.encodeTexture()` returns an object with a `texture` property with resulting WebGL texture handle.

## Development

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Development mode with watch
npm run watch
```

## Examples

Live examples are available at: **https://ludicon.github.io/spark.js/**

To run examples locally with hot reload:

```bash
npm run dev
```

This will open `http://localhost:5174/examples/index.thml` where you can browse the examples.

> [!NOTE]
> Browsers treat http://localhost as a secure context, so HTTPS is not required when testing locally on the same machine. However, to access the dev server from another device you must enable HTTPS for WebGPU features to work.
>
> To run the server with HTTPS, set the environment variable `HTTPS` to `true` before starting the server:
>
> ```bash
> HTTPS=true npm run serve
> ```


## Documentation

For full documentation, see the [API reference](API.md).

### `encodeTexture(source, options)`

Load an image and encode it to a compressed GPU texture.

#### Parameters

- **`source`** (`string | HTMLImageElement | ImageBitmap | HTMLCanvasElement | OffscreenCanvas | VideoFrame | GPUTexture | WebGLTexture`)  
  The image to encode.

- **`options`** *(optional object)*
  Configuration options for encoding:

  - **`format`** (`string`)
    Desired block compression format. The format can be specified in several different ways:

      - A channel mask indicating the number of channels in your input: `"rgba"`, `"rgb"`, `"rg"` or `"r"`, the actual format is selected based on the device capabilities.

      - An explicit WebGPU BC, ETC or ASTC format name, or an abbreviated form such as `"bc7"` or `"astc"`. Note: only 4x4 LDR formats are supported. 

      - If you specify `auto`, the input texture is analyzed to detect the necessary number of channels. This has some overhead, it's always recommended to specify the format through one of the other methods. 
    
    Default: `rgb`.

  - **`preferLowQuality`** 
    Hint for the automatic format selector. When the input format is `"rgb"` it chooses 8 bit per block formats like `"bc1"` or `"etc2"` instead of `"bc7"` or `"astc"`.

  - **`mips`** or **`generateMipmaps`** (`boolean`)
    Whether to generate mipmaps. Default: `false`.

  - **`mipmapFilter`** (`string`)
    The filter to use for mipmap generation. Can be `"box"` for a simple box filter, or `"magic"` for a higher-quality 4-tap filter with sharpening properties. Default: `"magic"`.

  - **`mipsAlphaScale`** (`number[]`)
    Optional array of alpha scale values to apply to each generated mipmap level. The array should contain one value per mipmap level (starting with mip level 1, since level 0 is the base image). Each value multiplies the alpha channel of the corresponding mipmap level. Values greater than 1.0 increase opacity, while values less than 1.0 increase transparency. This is useful for techniques like alpha-tested mipmaps where you want to compensate for alpha loss at lower mip levels. If the array is shorter than the number of mipmap levels, the last value is used for remaining levels. Only applies when `mips` is `true`. Default: `undefined` (no scaling applied).

  - **`srgb`** (`boolean`)
    Whether to encode the image using an as sRGB format. This also affects mipmap generation. The `srgb` mode can also be inferred from the `format`. Default: `false`. 

  - **`normal`** (`boolean`)
    Whether to interpret the image as a normal map. This affects automatic format selection favoring the use of `"bc5"` and `"eac-rg"` formats. Default: `false`.

  - **`flipY`** (`boolean`)
    Whether to vertically flip the image before encoding. Default: `false`.

  - **`outputTexture`** (`GPUTexture` for Spark, result object for SparkGL)
    A previously-returned texture to reuse as the output, avoiding reallocation when re-encoding into the same shape repeatedly. Reused only when its width, height, mipmap count, and format match the resolved output; otherwise a fresh texture is allocated and returned. Default: `undefined`.

#### Returns

- **Spark (WebGPU)**: `Promise<GPUTexture>` - A promise resolving to the encoded WebGPU texture.
- **SparkGL (WebGL2)**: `Promise<Object>` - A promise resolving to an object containing the compressed WebGL texture.


## Integration with three.js

Using spark.js with [three.js](https://threejs.org/) is straightforward. You can encode textures with Spark and expose them to three.js as external textures:

```js
// Load and encode texture using spark:
const gpuTexture = await spark.encodeTexture(textureUrl, { srgb: true, flipY: true });

// Wrap the GPUTexture for three.js
const externalTex = new THREE.ExternalTexture(gpuTexture);

// Then use as any other texture:
const material = new THREE.MeshBasicMaterial({ map: externalTex });

```

To facilitate the use of Spark when loading GLTF assets, import the provided helper:

```js
import { registerSparkLoader } from "@ludicon/spark.js/three-gltf";
```

Then register Spark with an existing GLTFLoader instance:

```js
const loader = new GLTFLoader()
registerSparkLoader(loader, spark)
```

After registration, the loader will automatically encode textures with Spark whenever applicable.

To use the Spark plugins with the three.js 3DTilesRenderer, you can pass them to the renderer's `GLTFExtensionsPlugin` as follows:

```js
import { createSparkPlugins } from "@ludicon/spark.js/three-gltf";

tiles = new TilesRenderer();
tiles.registerPlugin( new GLTFExtensionsPlugin( {
	plugins: createSparkPlugins( spark, { generateMipmaps: false } )
} ) );
```


## License

*spark.js* is free for non-commercial use. 

- The JavaScript code is released under MIT license. 
- Use of the *Spark* shaders is covered under the <a href="https://ludicon.com/sparkjs/eula.html">*spark.js* EULA</a>. 

See https://ludicon.com/sparkjs#Licensing for details on how to use *spark.js* in commercial projects.
