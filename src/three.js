import * as THREE from "three"

// Refcount table keyed by the underlying GPU/GL texture. Multiple
// SparkThreeExternalTexture wrappers may point at the same resource, but is
// only released when the last wrapper is disposed.
const refs = new WeakMap()

function retain(resource) {
  if (resource) refs.set(resource, (refs.get(resource) || 0) + 1)
}

/**
 * ExternalTexture subclass that tracks shared ownership of the underlying
 * GPU/GL texture across clones, so that disposing one wrapper doesn't destroy
 * the resource out from under its siblings. three.js's WebGPU backend takes
 * ownership of the underlying `GPUTexture` once the texture has been rendered
 * with, and will call `GPUTexture.destroy()` on every `dispose()` thereafter;
 * this class suppresses the 'dispose' event until the final wrapper goes away.
 *
 * A consequence of that suppression: user-registered `"dispose"` listeners on
 * intermediate wrappers do not fire — only the listeners on the wrapper that
 * actually releases the resource. That matches the refcount-zero semantics.
 *
 * @param {?(GPUTexture|WebGLTexture)} sourceTexture - The externally owned texture.
 * @param {?(resource: GPUTexture|WebGLTexture) => void} [onRelease] - Called
 *   when the final wrapper is disposed. For WebGL, pass
 *   `tex => gl.deleteTexture(tex)`. For WebGPU, pass `tex => tex.destroy()`.
 *   It is safe for three.js's backend to also release the resource — both
 *   `GPUTexture.destroy()` and `gl.deleteTexture()` are idempotent — so this
 *   callback covers the case where the texture was never rendered and three.js
 *   therefore never registered its own dispose handler.
 */
export class SparkThreeExternalTexture extends THREE.ExternalTexture {
  constructor(sourceTexture = null, onRelease = null) {
    super(sourceTexture)
    this._onRelease = onRelease
    retain(sourceTexture)
  }

  copy(source) {
    super.copy(source)
    // Retain a new reference for the new wrapper and inherit the release callback so
    // the clone can free the resource if it ends up being the last survivor.
    retain(this.sourceTexture)
    if (source instanceof SparkThreeExternalTexture) {
      this._onRelease = source._onRelease
    }
    return this
  }

  dispose() {
    const resource = this.sourceTexture
    const remaining = resource ? (refs.get(resource) || 1) - 1 : 0

    if (remaining > 0) {
      refs.set(resource, remaining)
      return
    }

    if (resource) refs.delete(resource)
    super.dispose()
    if (resource) this._onRelease?.(resource)
  }
}
