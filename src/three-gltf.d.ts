// Type definitions for @ludicon/spark.js/three-gltf
// Project: https://github.com/ludicon/spark.js

import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Spark, SparkGL, SparkEncodeOptions } from '@ludicon/spark.js'

/**
 * Options for the Spark GLTF loader plugin
 */
export interface SparkGLTFOptions extends Omit<SparkEncodeOptions, 'format'> {
  /**
   * Whether to generate mipmaps for textures.
   * @default true
   */
  mips?: boolean

  /**
   * Alias for mips. Whether to generate mipmaps.
   * @default true
   */
  generateMipmaps?: boolean

  /**
   * Hint for the automatic format selector. When true, chooses lower quality
   * formats like "bc1" or "etc2" instead of "bc7" or "astc".
   * @default false
   */
  preferLowQuality?: boolean
}

/**
 * Registers the Spark texture compression plugin with a Three.js GLTFLoader.
 * This plugin automatically compresses textures during GLTF loading using Spark.
 *
 * The plugin analyzes material usage to determine optimal compression formats for each texture:
 * - Base color textures use RGB or RGBA formats with sRGB encoding
 * - Normal maps use RG formats
 * - Metallic/roughness and other PBR textures use appropriate channel formats
 *
 * @param loader - The Three.js GLTFLoader instance to register the plugin with
 * @param spark - A Spark or SparkGL instance to use for texture compression
 * @param options - Optional encoding options to apply to all textures
 *
 * @example
 * ```typescript
 * import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
 * import { SparkGL } from '@ludicon/spark.js';
 * import { registerSparkLoader } from '@ludicon/spark.js/three-gltf';
 *
 * const canvas = document.createElement('canvas');
 * const gl = canvas.getContext('webgl2');
 * const spark = SparkGL.create(gl, { cacheTempResources: true });
 *
 * const loader = new GLTFLoader();
 * registerSparkLoader(loader, spark, { mips: true });
 *
 * loader.load('model.gltf', (gltf) => {
 *   scene.add(gltf.scene);
 * });
 * ```
 */
export function registerSparkLoader(loader: GLTFLoader, spark: Spark | SparkGL, options?: SparkGLTFOptions): void
