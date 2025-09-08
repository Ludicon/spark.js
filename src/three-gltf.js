import * as THREE from "three/webgpu"

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
  constructor(name, parser, spark) {
    this.name = name
    this.parser = parser

    this.loaders = {
      ["rgba"]: new SparkLoader(parser.fileLoader.manager, spark, "rgba"),
      ["rgba-srgb"]: new SparkLoader(parser.fileLoader.manager, spark, "rgba", THREE.SRGBColorSpace),
      ["rgb"]: new SparkLoader(parser.fileLoader.manager, spark, "rgb"),
      ["rgb-srgb"]: new SparkLoader(parser.fileLoader.manager, spark, "rgb", THREE.SRGBColorSpace),
      ["rg"]: new SparkLoader(parser.fileLoader.manager, spark, "rg"),
      ["r"]: new SparkLoader(parser.fileLoader.manager, spark, "r"),
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

        // Normal map unpacking not supported in three.js prior to r181
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
      assignTexture(materialDef.anisotropyTexture?.index, Channel.RGB)

      // KHR_materials_clearcoat
      assignTexture(materialDef.clearcoatTexture?.index, Channel.RGB, THREE.SRGBColorSpace)
      assignTexture(materialDef.clearcoatRoughnessTexture?.index, Channel.R)
      assignTexture(materialDef.clearcoatNormalTexture?.index, Channel.RG, THREE.NoColorSpace, true)

      // KHR_materials_diffuse_transmission
      assignTexture(materialDef.diffuseTransmissionTexture?.index, Channel.A)
      assignTexture(materialDef.diffuseTransmissionColorTexture?.index, Channel.RGB, THREE.SRGBColorSpace)

      // KHR_materials_iridescence
      assignTexture(materialDef.iridescenceTexture?.index, Channel.R)
      assignTexture(materialDef.iridescenceThicknessTexture?.index, Channel.G)

      // KHR_materials_sheen
      assignTexture(materialDef.sheenColorTexture?.index, Channel.RGB, THREE.SRGBColorSpace)
      assignTexture(materialDef.sheenRoughnessTextureIndex?.index, Channel.A)

      // KHR_materials_specular
      assignTexture(materialDef.specularTexture?.index, Channel.RGB, THREE.SRGBColorSpace)
      assignTexture(materialDef.specularColorTexture?.index, Channel.A)

      // KHR_materials_transmission
      assignTexture(materialDef.transmissionTexture?.index, Channel.R)

      // KHR_materials_volume
      assignTexture(materialDef.thicknessTexture?.index, Channel.G)
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
    const isUncompressed = this.textureIsUncompressed[textureIndex]

    let format = "rgba" // Default to 'rgba'
    if ((channels & Channel.R) == channels) {
      format = "r"
    } else if ((channels & Channel.RG) == channels) {
      format = "rg"
    } else if ((channels & Channel.RGB) == channels) {
      format = "rgb" + (colorSpace === THREE.SRGBColorSpace ? "-srgb" : "")
    } else {
      format = "rgba" + (colorSpace === THREE.SRGBColorSpace ? "-srgb" : "")
    }
    if (isUncompressed) {
      format = ""
    }

    const loader = this.loaders[format]

    return this.parser.loadTextureImage(textureIndex, imageIndex, loader)
  }
}

class SparkLoader extends THREE.TextureLoader {
  constructor(manager, spark, format, colorSpace = THREE.NoColorSpace) {
    super(manager)
    this.spark = spark
    this.format = format
    this.colorSpace = colorSpace
  }

  load(url, onLoad, onProgress, onError) {
    const format = this.format
    const srgb = this.colorSpace === THREE.SRGBColorSpace
    const mips = true

    this.spark
      .encodeTexture(url, { format, srgb, mips })
      .then(gpuTexture => {
        const texture = new THREE.ExternalTexture(gpuTexture)
        if (this.format == "rg" && "NormalRGPacking" in THREE) {
          texture.userData.unpackNormal = THREE.NormalRGPacking
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

export function registerSparkLoader(loader, spark) {
  // Remove existing webp and avif plugins:
  for (let i = 0; i < loader.pluginCallbacks.length; i++) {
    const plugin = loader.pluginCallbacks[i](loader)

    if (plugin.name == "EXT_texture_webp" || plugin.name == "EXT_texture_avif") {
      loader.unregister(loader.pluginCallbacks[i])
      i--
    }
  }

  // Install plugin for standard textures, and textures using webp and avif extensions.
  loader.register(parser => new GLTFSparkPlugin("spark", parser, spark))
  loader.register(parser => new GLTFSparkPlugin("EXT_texture_webp", parser, spark))
  loader.register(parser => new GLTFSparkPlugin("EXT_texture_avif", parser, spark))
}
