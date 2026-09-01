// Shared utilities for spark.js and spark-gl.js

/**
 * Normalize the cacheTempResources option, which is either a boolean or an object
 * { minSize, allocateMipmaps }. Returns { enabled, minSize, allocateMipmaps }.
 * - minSize: minimum width/height (in texels) cached resources are allocated for; 0 means
 *   "size of the encode that triggers the allocation".
 * - allocateMipmaps: allocate a full mip chain even if the triggering encode has no mipmaps.
 */
export function parseCacheTempResources(option) {
  if (typeof option === "object" && option !== null) {
    const minSize = option.minSize ?? 0
    if (!Number.isInteger(minSize) || minSize < 0) {
      throw new Error(`cacheTempResources.minSize must be a non-negative integer, got ${minSize}`)
    }
    return { enabled: true, minSize, allocateMipmaps: Boolean(option.allocateMipmaps) }
  }
  return { enabled: Boolean(option), minSize: 0, allocateMipmaps: false }
}

// Generated mip chains stop at 4x4 by default, the size of a compressed block.
const MIN_MIP_SIZE = 4

/** Number of mip levels from width x height down to minSize x minSize (or the nearest level above it). */
export function fullMipmapCount(width, height, minSize = MIN_MIP_SIZE) {
  let count = 1
  let w = width
  let h = height
  while (w > minSize || h > minSize) {
    count++
    w = Math.max(1, Math.floor(w / 2))
    h = Math.max(1, Math.floor(h / 2))
  }
  return count
}

/**
 * Resolve the mip levels of an encode from options.mipmapCount and options.mips/generateMipmaps.
 *
 * `mipmapCount` is the number of levels of the output texture: an explicit count is clamped to
 * the full chain down to 1x1; the default is the chain down to 4x4 with `mips`, else 1.
 * `encodedMipmapCount` is the number of levels this encode writes: all of them with `mips`,
 * otherwise only level 0, leaving the rest for later encodes (see options.outputMipLevel).
 *
 * Returns { mipmapCount, encodedMipmapCount }.
 */
export function resolveMipmapCount(options, width, height) {
  const generateMipmaps = Boolean(options.generateMipmaps || options.mips)
  let mipmapCount
  if (options.mipmapCount !== undefined) {
    if (!Number.isInteger(options.mipmapCount) || options.mipmapCount < 1) {
      throw new Error(`mipmapCount must be a positive integer, got ${options.mipmapCount}`)
    }
    mipmapCount = Math.min(options.mipmapCount, fullMipmapCount(width, height, 1))
  } else {
    mipmapCount = generateMipmaps ? fullMipmapCount(width, height) : 1
  }
  return { mipmapCount, encodedMipmapCount: generateMipmaps ? mipmapCount : 1 }
}

/**
 * Decide whether the caller's output texture receives the encoded result.
 *
 * `existing` describes options.outputTexture as { width, height, mipLevelCount, format } (null
 * when none was given); `expected` is the resolved encode as { width, height, mipmapCount,
 * encodedMipmapCount, format }.
 *
 * Without `outputMipLevel`, the texture is a hint: it is reused only when it matches the texture
 * the encode would allocate exactly, otherwise the caller gets a fresh texture. With
 * `outputMipLevel` (even 0), the texture is a requirement: level 0 of the encode lands at that mip
 * level, the texture must be the encode scaled up by that many levels and have room for all the
 * encoded levels, and a mismatch throws.
 *
 * Returns { reuse, outputMipLevel }.
 */
export function resolveOutputTexture(options, existing, expected) {
  const outputMipLevel = options.outputMipLevel ?? 0
  const strict = options.outputMipLevel !== undefined
  if (!Number.isInteger(outputMipLevel) || outputMipLevel < 0) {
    throw new Error(`outputMipLevel must be a non-negative integer, got ${outputMipLevel}`)
  }
  if (strict && !existing) {
    throw new Error("outputMipLevel requires an outputTexture")
  }

  const reuse =
    Boolean(existing) &&
    existing.format === expected.format &&
    Math.max(1, existing.width >> outputMipLevel) === expected.width &&
    Math.max(1, existing.height >> outputMipLevel) === expected.height &&
    (strict ? existing.mipLevelCount >= outputMipLevel + expected.encodedMipmapCount : existing.mipLevelCount === expected.mipmapCount)

  if (strict && !reuse) {
    throw new Error(
      `outputTexture does not fit the encode: mip level ${outputMipLevel} must be ` +
        `${expected.width}x${expected.height} in format ${expected.format} with at least ` +
        `${expected.encodedMipmapCount} levels below it, got a ${existing.width}x${existing.height} ` +
        `${existing.format} texture with ${existing.mipLevelCount} levels`
    )
  }
  return { reuse, outputMipLevel }
}

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

export function isIOS() {
  return (
    ["iPad Simulator", "iPhone Simulator", "iPod Simulator", "iPad", "iPhone", "iPod"].includes(navigator.platform) ||
    // iPad on iOS 13 detection
    (navigator.userAgent.includes("Mac") && "ontouchend" in document)
  )
}

export function getSafariVersion() {
  const ua = navigator.userAgent
  // Safari detection: must contain "Safari/" but NOT "Chrome" or "Chromium"
  // Chrome's UA: "...Chrome/xxx Safari/xxx"
  // Safari's UA: "...Safari/xxx" (without Chrome)
  if (ua.includes("Chrome") || ua.includes("Chromium")) {
    return null
  }
  const match = ua.match(/Safari\/(\d+(\.\d+)?)/)
  return match && parseFloat(match[1])
}

export function getFirefoxVersion() {
  const match = navigator.userAgent.match(/Firefox\/(\d+(\.\d+)?)/)
  return match && parseFloat(match[1])
}

export function isSvgUrl(url) {
  return /\.svg(?:$|\?)/i.test(url) || /^data:image\/svg\+xml[,;]/i.test(url)
}

const MIME_FROM_EXT = {
  avif: "image/avif",
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif"
}

function mimeTypeFromUrl(url) {
  const ext = url.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase()
  return MIME_FROM_EXT[ext]
}

export async function loadImageDecoder(url) {
  const res = await fetch(url, { mode: "cors" })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)

  const contentType = res.headers.get("Content-Type")?.split(";")[0].trim()
  const mimeType = contentType || mimeTypeFromUrl(url)

  if (!mimeType || !(await ImageDecoder.isTypeSupported(mimeType))) {
    // Fall back to createImageBitmap when ImageDecoder can't handle the type.
    const blob = await res.blob()
    return createImageBitmap(blob, {
      imageOrientation: "none",
      colorSpaceConversion: "none",
      premultiplyAlpha: "none"
    })
  }

  const decoder = new ImageDecoder({
    data: res.body,
    type: mimeType,
    colorSpaceConversion: "none",
    preferAnimation: false
  })

  try {
    // Returns a VideoFrame; caller is responsible for calling .close() on it.
    const { image } = await decoder.decode({ frameIndex: 0, completeFramesOnly: true })
    return image
  } finally {
    decoder.close()
  }
}

export function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.decoding = "async" // hint to decode off the main thread when possible
    img.onload = () => resolve(img) // returns HTMLImageElement
    img.onerror = reject
    img.src = url
  })
}

export async function loadImageBitmap(url) {
  const res = await fetch(url, { mode: "cors" })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const blob = await res.blob()

  // Note: createImageBitmap doesn't support image/svg+xml
  return createImageBitmap(blob, {
    imageOrientation: "none",
    colorSpaceConversion: "none",
    premultiplyAlpha: "none"
  })
}

const webkitVersion = getSafariVersion()
const firefoxVersion = getFirefoxVersion()

// Safari 18.2 (Tahoe) introduced support for SVG in copyExternalImageToTexture
const SAFARI_TAHOE_VERSION = 619.1 // Safari 18.2
const needsSvgImageBitmapWorkaround = webkitVersion && webkitVersion < SAFARI_TAHOE_VERSION

// Safari always prefers image element over image bitmap.
// @@ Does this handle RGBA images correctly?
const useImageElement = webkitVersion

// ImageDecoder is only available in Firefox 133+ and Chrome, but Chrome does not support AVIF.
const useImageDecoder = (firefoxVersion && firefoxVersion >= 133) || true

async function convertImageElementToImageBitmap(img) {
  // Render HTMLImageElement to canvas, then create ImageBitmap
  const canvas = document.createElement("canvas")
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  const ctx = canvas.getContext("2d")
  ctx.drawImage(img, 0, 0)

  // Convert canvas to ImageBitmap
  return createImageBitmap(canvas)
}

export async function loadImage(url) {
  // webkit: loadImageElement is faster than createImageBitmap.
  // webkit: certain images do not load correctly with loadImageBitmap.
  // chrome: linear images load incorrectly with loadImageElement.
  // chrome: loadImageBitmap is slightly faster.
  // chrome: loadImageBitmap does not support svg files.

  const isSvg = isSvgUrl(url)

  if (isSvg && needsSvgImageBitmapWorkaround) {
    // Older Safari: load SVG as HTMLImageElement, then convert to ImageBitmap
    const img = await loadImageElement(url)
    return convertImageElementToImageBitmap(img)
  } else if (isSvg || useImageElement) {
    return loadImageElement(url)
  } else if (useImageDecoder) {
    return loadImageDecoder(url)
  } else {
    return loadImageBitmap(url)
  }
}

// Decode a Blob to either a VideoFrame (via ImageDecoder) or an ImageBitmap. Mirrors the
// dispatch in loadImageDecoder/loadImageBitmap but skips the fetch since the bytes are in hand.
// Caller owns the returned object (close() it when done).
export async function loadImageFromBlob(blob) {
  if (useImageDecoder && blob.type && (await ImageDecoder.isTypeSupported(blob.type))) {
    const decoder = new ImageDecoder({
      data: blob.stream(),
      type: blob.type,
      colorSpaceConversion: "none",
      preferAnimation: false
    })
    try {
      const { image } = await decoder.decode({ frameIndex: 0, completeFramesOnly: true })
      return image
    } finally {
      decoder.close()
    }
  }
  return createImageBitmap(blob, {
    imageOrientation: "none",
    colorSpaceConversion: "none",
    premultiplyAlpha: "none"
  })
}
