// Type definitions for @ludicon/spark.js/three
import { ExternalTexture } from "three"

/**
 * Callback invoked when the final SparkThreeExternalTexture wrapping a given
 * resource is disposed. Required for WebGL (the three.js WebGL backend does
 * not release ExternalTexture resources); unnecessary for WebGPU, where the
 * three.js backend destroys the GPUTexture automatically.
 */
export type SparkThreeExternalTextureRelease = (resource: GPUTexture | WebGLTexture) => void

/**
 * ExternalTexture subclass that reference-counts the underlying GPU/GL
 * texture so that multiple wrappers (including clones) can safely share a
 * single resource. The resource is released only when the last wrapper is
 * disposed.
 */
export class SparkThreeExternalTexture extends ExternalTexture {
  constructor(sourceTexture?: GPUTexture | WebGLTexture | null, onRelease?: SparkThreeExternalTextureRelease | null)
  copy(source: SparkThreeExternalTexture | ExternalTexture): this
  dispose(): void
}
