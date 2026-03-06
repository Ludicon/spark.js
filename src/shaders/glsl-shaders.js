// WebGL shaders - lazy dynamic imports for tree-shaking AND runtime efficiency
export default {
  "spark_astc_rgb.glsl": () => import("./spark_astc_rgb.glsl?raw").then(m => m.default),
  "spark_astc_rgba.glsl": () => import("./spark_astc_rgba.glsl?raw").then(m => m.default),
  "spark_bc1_rgb.glsl": () => import("./spark_bc1_rgb.glsl?raw").then(m => m.default),
  "spark_bc4_r.glsl": () => import("./spark_bc4_r.glsl?raw").then(m => m.default),
  "spark_bc5_rg.glsl": () => import("./spark_bc5_rg.glsl?raw").then(m => m.default),
  "spark_bc7_rgb.glsl": () => import("./spark_bc7_rgb.glsl?raw").then(m => m.default),
  "spark_bc7_rgba.glsl": () => import("./spark_bc7_rgba.glsl?raw").then(m => m.default),
  "spark_eac_r.glsl": () => import("./spark_eac_r.glsl?raw").then(m => m.default),
  "spark_eac_rg.glsl": () => import("./spark_eac_rg.glsl?raw").then(m => m.default),
  "spark_etc2_rgb.glsl": () => import("./spark_etc2_rgb.glsl?raw").then(m => m.default)
}
