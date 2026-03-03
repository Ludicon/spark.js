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

export async function loadImageBitmap(url, opts = {}) {
  const res = await fetch(url, { mode: "cors" })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const blob = await res.blob()

  // Note: createImageBitmap doesn't support image/svg+xml
  return createImageBitmap(blob, {
    imageOrientation: opts.flipY ? "flipY" : "none",
    colorSpaceConversion: opts.colorSpaceConversion ?? "none",
    premultiplyAlpha: "none"
  })
}

const webkitVersion = getSafariVersion()

export function loadImage(url, opts = {}) {
  // webkit: loadImageElement is faster than createImageBitmap.
  // webkit: certain images do not load correctly with loadImageBitmap.
  // chrome: linear images load incorrectly with loadImageElement.
  // chrome: loadImageBitmap is slightly faster.
  // chrome: loadImageBitmap does not support svg files.
  if (isSvgUrl(url) || webkitVersion) {
    return loadImageElement(url)
  } else {
    return loadImageBitmap(url, opts)
  }
}
