// Shared utilities for spark.js and spark-gl.js

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

/*
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

// Decode via WebCodecs ImageDecoder, then wrap the VideoFrame as an ImageBitmap
// so callers see the same return type as loadImageBitmap.
//
// Motivation: on Firefox, createImageBitmap(blob) still runs image decode on the
// main thread for several formats (AVIF in particular). ImageDecoder performs
// decode off the main thread and returns a decoded VideoFrame; wrapping that
// frame with createImageBitmap is effectively a handle copy, not a second decode.
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

// Only use image decoder in Firefox.
const hasImageDecoder = typeof globalThis.ImageDecoder !== "undefined"
const useImageDecoder = hasImageDecoder && false // getFirefoxVersion()
*/

const webkitVersion = getSafariVersion()

// Safari 18.2 (Tahoe) introduced support for SVG in copyExternalImageToTexture
const SAFARI_TAHOE_VERSION = 619.1 // Safari 18.2
const needsSvgImageBitmapWorkaround = webkitVersion && webkitVersion < SAFARI_TAHOE_VERSION

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
  } else if (isSvg || webkitVersion) {
    return loadImageElement(url)
    // } else if (useImageDecoder) {
    //   // ImageDecoder doesn't support SVG; the branches above already handle that.
    //   return loadImageDecoder(url)
  } else {
    return loadImageBitmap(url)
  }
}
