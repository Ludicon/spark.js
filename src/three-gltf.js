import * as THREE from "three"

const Channel = {
  R: 1, // 0001
  G: 2, // 0010
  B: 4, // 0100
  A: 8, // 1000
  RG: 3, // 0011
  RGB: 7, // 0111
  RGBA: 15 // 1111
}

class GLTFSparkPlugin {
  constructor(name, parser, spark, options) {
    this.name = name
    this.parser = parser

    this.loaders = {
      ["rgba"]: new SparkLoader(parser.fileLoader.manager, spark, options, "rgba"),
      ["rgba-srgb"]: new SparkLoader(parser.fileLoader.manager, spark, options, "rgba", THREE.SRGBColorSpace),
      ["rgb"]: new SparkLoader(parser.fileLoader.manager, spark, options, "rgb"),
      ["rgb-srgb"]: new SparkLoader(parser.fileLoader.manager, spark, options, "rgb", THREE.SRGBColorSpace),
      ["rg"]: new SparkLoader(parser.fileLoader.manager, spark, options, "rg"),
      ["normal"]: new SparkLoader(parser.fileLoader.manager, spark, { ...options, normal: true }, "rg"),
      ["r"]: new SparkLoader(parser.fileLoader.manager, spark, options, "r"),
      [""]: new THREE.TextureLoader()
    }

    const textureCount = this.parser.json.textures?.length || 0
    const textureColorSpaces = new Array(textureCount).fill(THREE.NoColorSpace)
    const textureChannels = new Array(textureCount).fill(0)
    const textureIsNormal = new Array(textureCount).fill(false)
    const textureIsUncompressed = new Array(textureCount).fill(false)

    function assignTexture(index, channels, colorSpace, isNormal, isUncompressed) {
      if (index === undefined) return

      textureChannels[index] |= channels

      if (colorSpace) {
        textureColorSpaces[index] = colorSpace
      }
      if (isNormal) {
        textureIsNormal[index] = true

        // Normal map unpacking not supported in three.js prior to r182
        if (!("NormalRGPacking" in THREE)) {
          textureChannels[index] |= Channel.RGB
        }
      }
      if (isUncompressed) {
        textureIsUncompressed[index] = true
      }
    }

    for (const materialDef of this.parser.json.materials) {
      const baseColorTextureIndex = materialDef.pbrMetallicRoughness?.baseColorTexture?.index
      if (baseColorTextureIndex !== undefined) {
        textureColorSpaces[baseColorTextureIndex] = THREE.SRGBColorSpace
        textureChannels[baseColorTextureIndex] |= Channel.RGB

        // Base color texture expects alpha when alpha mode is MASK or BLEND.
        if (materialDef.alphaMode == "MASK" || materialDef.alphaMode == "BLEND") {
          textureChannels[baseColorTextureIndex] |= Channel.A
        }
      }

      assignTexture(materialDef.normalTexture?.index, Channel.RG, THREE.NoColorSpace, true)
      assignTexture(materialDef.emissiveTexture?.index, Channel.RGB, THREE.SRGBColorSpace)
      assignTexture(materialDef.occlusionTexture?.index, Channel.R)
      assignTexture(materialDef.pbrMetallicRoughness?.metallicRoughnessTexture?.index, Channel.G | Channel.B)

      // KHR_materials_anisotropy - RG contains direction, B contains strength.
      const anisotropyDef = materialDef.extensions?.KHR_materials_anisotropy
      if (anisotropyDef) {
        assignTexture(anisotropyDef.anisotropyTexture?.index, Channel.RGB)
      }

      // KHR_materials_clearcoat
      const clearcoatDef = materialDef.extensions?.KHR_materials_clearcoat
      if (clearcoatDef) {
        assignTexture(clearcoatDef.clearcoatTexture?.index, Channel.RGB, THREE.SRGBColorSpace)
        assignTexture(clearcoatDef.clearcoatRoughnessTexture?.index, Channel.R)
        assignTexture(clearcoatDef.clearcoatNormalTexture?.index, Channel.RG, THREE.NoColorSpace, true)
      }

      // KHR_materials_diffuse_transmission
      const diffuseTransmissionDef = materialDef.extensions?.KHR_materials_diffuse_transmission
      if (diffuseTransmissionDef) {
        assignTexture(diffuseTransmissionDef.diffuseTransmissionTexture?.index, Channel.A)
        assignTexture(diffuseTransmissionDef.diffuseTransmissionColorTexture?.index, Channel.RGB, THREE.SRGBColorSpace)
      }

      // KHR_materials_iridescence
      const iridescenceDef = materialDef.extensions?.KHR_materials_iridescence
      if (iridescenceDef) {
        assignTexture(iridescenceDef.iridescenceTexture?.index, Channel.R)
        assignTexture(iridescenceDef.iridescenceThicknessTexture?.index, Channel.G)
      }

      // KHR_materials_sheen
      const sheenDef = materialDef.extensions?.KHR_materials_sheen
      if (sheenDef) {
        assignTexture(sheenDef.sheenColorTexture?.index, Channel.RGB, THREE.SRGBColorSpace)
        assignTexture(sheenDef.sheenRoughnessTextureIndex?.index, Channel.A)
      }

      // KHR_materials_specular
      const specularDef = materialDef.extensions?.KHR_materials_specular
      if (specularDef) {
        assignTexture(specularDef.specularTexture?.index, Channel.RGB, THREE.SRGBColorSpace)
        assignTexture(specularDef.specularColorTexture?.index, Channel.A)
      }

      // KHR_materials_transmission
      const transmissionDef = materialDef.extensions?.KHR_materials_transmission
      if (transmissionDef) {
        assignTexture(transmissionDef.transmissionTexture?.index, Channel.R)
      }

      // KHR_materials_volume
      const volumeDef = materialDef.extensions?.KHR_materials_volume
      if (volumeDef) {
        assignTexture(volumeDef.thicknessTexture?.index, Channel.G)
      }
    }

    this.textureColorSpaces = textureColorSpaces
    this.textureChannels = textureChannels
    this.textureIsNormal = textureIsNormal
    this.textureIsUncompressed = textureIsUncompressed
  }

  loadTexture(textureIndex) {
    const tex = this.parser.json.textures[textureIndex]
    const imageIndex = tex.source ?? tex.extensions.EXT_texture_webp?.source ?? tex.extensions.EXT_texture_avif?.source
    const colorSpace = this.textureColorSpaces[textureIndex]
    const channels = this.textureChannels[textureIndex]
    const isNormal = this.textureIsNormal[textureIndex]
    const isUncompressed = this.textureIsUncompressed[textureIndex]

    let format
    if (channels & Channel.A) {
      format = "rgba" + (colorSpace === THREE.SRGBColorSpace ? "-srgb" : "")
    } else if (channels & Channel.B) {
      format = "rgb" + (colorSpace === THREE.SRGBColorSpace ? "-srgb" : "")
    } else if (channels & Channel.G) {
      format = "rg"
    } else {
      format = "r"
    }

    if (isUncompressed) {
      format = ""
    } else if (isNormal) {
      format = "normal"
    }

    const loader = this.loaders[format]

    return this.parser.loadTextureImage(textureIndex, imageIndex, loader)
  }
}

class SparkLoader extends THREE.TextureLoader {
  constructor(manager, spark, options, format, colorSpace = THREE.NoColorSpace) {
    super(manager)
    this.spark = spark
    this.format = format
    this.colorSpace = colorSpace
    this.options = options
  }

  load(url, onLoad, onProgress, onError) {
    const format = this.format
    const srgb = this.colorSpace === THREE.SRGBColorSpace
    const mips = true
    const normal = this.options.normal // this.format == "rg"

    this.spark
      .encodeTexture(url, { format, srgb, mips, normal, preferLowQuality: this.options.preferLowQuality })
      .then(textureObject => {
        // Handle both WebGPU (GPUTexture) and WebGL (object with .texture property)
        const gpuTexture = textureObject.texture !== undefined ? textureObject.texture : textureObject
        const texture = new THREE.ExternalTexture(gpuTexture)
        if (this.format == "rg" && "NormalRGPacking" in THREE) {
          // This is not understood by stock three.js
          // texture.userData.unpackNormal = THREE.NormalRGPacking
          if (textureObject.texture !== undefined) {
            texture.format = textureObject.format
          } else {
            if (texture.format == "bc5-rg-unorm") texture.format = THREE.RED_GREEN_RGTC2_Format
            else if (texture.format == "eac-rg11unorm") texture.format = THREE.RG11_EAC_Format
            else texture.format = THREE.RGFormat
          }
        }
        onLoad(texture)
      })
      .catch(err => {
        // Fallback: load the original image uncompressed
        super.load(
          url,
          tex => {
            tex.colorSpace = this.colorSpace
            onLoad?.(tex)
          },
          onProgress,
          // If the fallback also fails, surface the original encoder error first
          fallbackErr => onError?.(err ?? fallbackErr)
        )
      })
  }
}

export function registerSparkLoader(loader, spark, options = {}) {
  // Remove existing webp and avif plugins:
  for (let i = 0; i < loader.pluginCallbacks.length; i++) {
    const plugin = loader.pluginCallbacks[i](loader)

    if (plugin.name == "EXT_texture_webp" || plugin.name == "EXT_texture_avif") {
      loader.unregister(loader.pluginCallbacks[i])
      i--
    }
  }

  // Install plugin for standard textures, and textures using webp and avif extensions.
  loader.register(parser => new GLTFSparkPlugin("spark", parser, spark, options))
  loader.register(parser => new GLTFSparkPlugin("EXT_texture_webp", parser, spark, options))
  loader.register(parser => new GLTFSparkPlugin("EXT_texture_avif", parser, spark, options))
}
