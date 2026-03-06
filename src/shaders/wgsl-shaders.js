// WebGPU shaders - lazy dynamic imports for tree-shaking AND runtime efficiency
export default {
  "spark_astc_rgb.wgsl": () => import("./spark_astc_rgb.wgsl?raw").then(m => m.default),
  "spark_astc_rgba.wgsl": () => import("./spark_astc_rgba.wgsl?raw").then(m => m.default),
  "spark_bc1_rgb.wgsl": () => import("./spark_bc1_rgb.wgsl?raw").then(m => m.default),
  "spark_bc4_r.wgsl": () => import("./spark_bc4_r.wgsl?raw").then(m => m.default),
  "spark_bc5_rg.wgsl": () => import("./spark_bc5_rg.wgsl?raw").then(m => m.default),
  "spark_bc7_rgb.wgsl": () => import("./spark_bc7_rgb.wgsl?raw").then(m => m.default),
  "spark_bc7_rgba.wgsl": () => import("./spark_bc7_rgba.wgsl?raw").then(m => m.default),
  "spark_eac_r.wgsl": () => import("./spark_eac_r.wgsl?raw").then(m => m.default),
  "spark_eac_rg.wgsl": () => import("./spark_eac_rg.wgsl?raw").then(m => m.default),
  "spark_etc2_rgb.wgsl": () => import("./spark_etc2_rgb.wgsl?raw").then(m => m.default),
  "utils.wgsl": () => import("./utils.wgsl?raw").then(m => m.default)
}
