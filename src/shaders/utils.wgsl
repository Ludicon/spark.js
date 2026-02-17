struct Params {
    colorMode: u32,
    alphaScale: f32,
};

const COLOR_LINEAR : u32 = 0u;
const COLOR_SRGB   : u32 = 1u;
const COLOR_NORMAL : u32 = 2u;

@group(0) @binding(0) var src : texture_2d<f32>;
@group(0) @binding(1) var dst : texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var smp: sampler;
@group(0) @binding(3) var<uniform> params: Params;

fn srgb_to_linear_vec3(c: vec3<f32>) -> vec3<f32> {
    return select(pow((c + vec3f(0.055)) * vec3f(1.0 / 1.055), vec3f(2.4)),
        c * vec3f(1.0 / 12.92),
        c <= vec3f(0.04045)
    );
}
fn srgb_to_linear_vec4(c: vec4<f32>) -> vec4<f32> {
    return vec4<f32>(srgb_to_linear_vec3(c.xyz), c.w);
}

fn linear_to_srgb_vec3(c: vec3<f32>) -> vec3<f32> {
    return select(
        1.055 * pow(c, vec3<f32>(1.0 / 2.4)) - 0.055,
        c * 12.92,
        c <= vec3<f32>(0.0031308)
    );
}
fn linear_to_srgb_vec4(c: vec4<f32>) -> vec4<f32> {
    return vec4<f32>(linear_to_srgb_vec3(c.xyz), c.w);
}

fn normalize_vec4(c: vec4<f32>) -> vec4<f32> {
    if (c.z == 0.0) {
        // If the normal is stored with only the XY components, there's no need to normalize.
        return c;
    }
    else {
        return vec4<f32>(saturate(0.5 * normalize(2 * c.xyz - 1) + 0.5), c.w);
    }
}

@compute @workgroup_size(8, 8)
fn mipmap(@builtin(global_invocation_id) id : vec3<u32>) {
    let dstSize = textureDimensions(dst).xy;
    if (id.x >= dstSize.x || id.y >= dstSize.y) {
        return;
    }

    let size_rcp = vec2f(1.0) / vec2f(dstSize);

    // We take 4 samples explicitly in order to support alpha weighting and for slightly more correct
    // results when using non multiple of two textures.
    let uv0 = (vec2f(id.xy) + vec2f(0.25)) * size_rcp;
    let uv1 = uv0 + 0.5 * size_rcp;

    var color = vec4f(0.0);

    if (params.colorMode == COLOR_SRGB) {
        let c00 = textureSampleLevel(src, smp, vec2f(uv0.x, uv0.y), 0);
        let c10 = textureSampleLevel(src, smp, vec2f(uv1.x, uv0.y), 0);
        let c01 = textureSampleLevel(src, smp, vec2f(uv0.x, uv1.y), 0);
        let c11 = textureSampleLevel(src, smp, vec2f(uv1.x, uv1.y), 0);

        let a00 = c00.a;
        let a10 = c10.a;
        let a01 = c01.a;
        let a11 = c11.a;
        let a_sum = a00 + a10 + a01 + a11;

        color.a = 0.25 * a_sum;
        if (a_sum > 1.0 / 256.0) {
            color.r = (c00.r * a00 + c10.r * a10 + c01.r * a01 + c11.r * a11) / a_sum;
            color.g = (c00.g * a00 + c10.g * a10 + c01.g * a01 + c11.g * a11) / a_sum;
            color.b = (c00.b * a00 + c10.b * a10 + c01.b * a01 + c11.b * a11) / a_sum;
        } else {
            color.r = 0.25 * (c00.r + c10.r + c01.r + c11.r);
            color.g = 0.25 * (c00.g + c10.g + c01.g + c11.g);
            color.b = 0.25 * (c00.b + c10.b + c01.b + c11.b);
        }
    }
    else {
        // For linear colors, we assume no alpha.
        // @@ We could normalize/reconstruct normals before averaging.
        color += textureSampleLevel(src, smp, vec2f(uv0.x, uv0.y), 0);
        color += textureSampleLevel(src, smp, vec2f(uv1.x, uv0.y), 0);
        color += textureSampleLevel(src, smp, vec2f(uv0.x, uv1.y), 0);
        color += textureSampleLevel(src, smp, vec2f(uv1.x, uv1.y), 0);
        color *= 0.25;
    }

    // This would be the single sample implementation:
    // let uv = (vec2f(id.xy) + vec2f(0.5)) * size_rcp;
    // var color = textureSampleLevel(src, smp, vec2f(uv.x, uv.y), 0);

    if (params.colorMode == COLOR_SRGB) {
        color = linear_to_srgb_vec4(color);
        color.a = color.a * params.alphaScale;
    } else if (params.colorMode == COLOR_NORMAL) {
        color = normalize_vec4(color);
    }

    textureStore(dst, id.xy, color);
}

// Simple version without shared memory (for comparison)
@compute @workgroup_size(8, 8)
fn magic_mipmap_simple(@builtin(global_invocation_id) id: vec3<u32>) {

    let dstSize = textureDimensions(dst).xy;
    if (id.x >= dstSize.x || id.y >= dstSize.y) {
        return;
    }

    let sizeRcp = vec2f(0.5) / vec2f(dstSize);
    let base = 2.0 * vec2<f32>(id.xy) - vec2<f32>(1.5, 1.5); // - 2 + 0.5

    // Integer weights (normalization applied at the end).
    let w: array<f32, 6> = array<f32, 6>(1.0, -5.0, 20.0, 20.0, -5.0, 1.0);

    var accum: vec4<f32> = vec4<f32>(0.0);

    // 6x6 taps around (base.x, base.y):
    for (var j: i32 = 0; j < 6; j = j + 1) {
        let v = (base.y + f32(j)) * sizeRcp.y;

        var row: vec4<f32> = vec4<f32>(0.0);
        for (var i: i32 = 0; i < 6; i = i + 1) {
            let wx = w[i];
            let u = (base.x + f32(i)) * sizeRcp.x;

            row = row + wx * textureSampleLevel(src, smp, vec2f(u, v), 0);
        }

        let wy = w[j];
        accum = accum + wy * row;
    }

    // Normalize: (/32) horizontally and (/32) vertically => /1024.
    var color = accum * (1.0 / 1024.0);

    if (params.colorMode == COLOR_SRGB) {
        color = linear_to_srgb_vec4(color);
        color.a = color.a * params.alphaScale;
    } else if (params.colorMode == COLOR_NORMAL) {
        color = normalize_vec4(color);
    }

    textureStore(dst, id.xy, color);
}

const TILE_SIZE = 20u;
const WORKGROUP_SIZE = 8u;
const N = TILE_SIZE * TILE_SIZE;

// Shared memory for optimized mipmap computation
// For 8x8 workgroup, we need 8*2+5 = 21 pixels in each dimension (with 6-tap kernel)
var<workgroup> sharedData: array<f32, 4 * N>;

@compute @workgroup_size(8, 8)
fn magic_mipmap(
    @builtin(global_invocation_id) id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>,
    @builtin(workgroup_id) group_id: vec3<u32>
) {
    let dstSize = textureDimensions(dst).xy;

    // Load data into shared memory cooperatively
    let sizeRcp = vec2f(0.5) / vec2f(dstSize);
    let groupBase = vec2f(group_id.xy * WORKGROUP_SIZE);
    let srcBase = 2.0 * groupBase - vec2f(1.5);

    const samplesPerThread = (TILE_SIZE * TILE_SIZE + WORKGROUP_SIZE * WORKGROUP_SIZE - 1u) / (WORKGROUP_SIZE * WORKGROUP_SIZE);
    let threadIdx = local_id.y * WORKGROUP_SIZE + local_id.x;

    for (var s = 0u; s < samplesPerThread; s = s + 1u) {
        let flatIdx = threadIdx + s * (WORKGROUP_SIZE * WORKGROUP_SIZE);
        if (flatIdx < TILE_SIZE * TILE_SIZE) {
            let sharedY = flatIdx / TILE_SIZE;
            let sharedX = flatIdx % TILE_SIZE;

            let srcPos = srcBase + vec2f(f32(sharedX), f32(sharedY));
            let uv = srcPos * sizeRcp;

            let color = textureSampleLevel(src, smp, uv, 0);
            if (params.colorMode == COLOR_SRGB) {
                sharedData[0 * N + flatIdx] = color.r * color.a;
                sharedData[1 * N + flatIdx] = color.g * color.a;
                sharedData[2 * N + flatIdx] = color.b * color.a;
                sharedData[3 * N + flatIdx] = color.a;
            }
            else {
                sharedData[0 * N + flatIdx] = color.r;
                sharedData[1 * N + flatIdx] = color.g;
                sharedData[2 * N + flatIdx] = color.b;
                sharedData[3 * N + flatIdx] = color.a;
            }
        }
    }

    // Synchronize to ensure all data is loaded
    workgroupBarrier();

    // Check bounds
    if (id.x >= dstSize.x || id.y >= dstSize.y) {
        return;
    }

    // Integer weights (normalization applied at the end).
    let w: array<f32, 6> = array<f32, 6>(1.0, -5.0, 20.0, 20.0, -5.0, 1.0);

    var accum: vec4<f32> = vec4<f32>(0.0);

    // Perform 6x6 convolution using shared memory
    // Local position within shared memory
    let sharedBaseX = local_id.x * 2u;
    let sharedBaseY = local_id.y * 2u;

    for (var j: u32 = 0u; j < 6u; j = j + 1u) {
        var row: vec4<f32> = vec4<f32>(0.0);
        for (var i: u32 = 0u; i < 6u; i = i + 1u) {
            let sharedIdx = (sharedBaseY + j) * TILE_SIZE + (sharedBaseX + i);
            let c = vec4f(sharedData[sharedIdx], sharedData[N + sharedIdx], sharedData[2 * N + sharedIdx], sharedData[3 * N + sharedIdx]);
            row = row + w[i] * c;
        }
        accum = accum + w[j] * row;
    }

    if (params.colorMode == COLOR_SRGB) {
        if (accum.a >= 1.0 / 256.0) {
            let scale = 1024.0 / accum.a;
            accum.r = accum.r * scale;
            accum.g = accum.g * scale;
            accum.b = accum.b * scale;
        }
    }

    // Normalize: (/32) horizontally and (/32) vertically => /1024.
    var color = accum * (1.0 / 1024.0);

    if (params.colorMode == COLOR_SRGB) {
        color = linear_to_srgb_vec4(color);
        color.a = color.a * params.alphaScale;
    } else if (params.colorMode == COLOR_NORMAL) {
        color = normalize_vec4(color);
    }

    textureStore(dst, id.xy, color);
}

@compute @workgroup_size(8, 8)
fn resize(@builtin(global_invocation_id) id : vec3<u32>) {
    let dstSize = textureDimensions(dst).xy;
    if (id.x >= dstSize.x || id.y >= dstSize.y) {
        return;
    }

    let uv = (vec2f(id.xy) + vec2f(0.5)) / vec2f(dstSize);
    var color = textureSampleLevel(src, smp, uv, 0);

    if (params.colorMode == COLOR_SRGB) {
        color = linear_to_srgb_vec4(color);
    } else if (params.colorMode == COLOR_NORMAL) {
        color = normalize_vec4(color);
    }

    textureStore(dst, id.xy, color);
}

@compute @workgroup_size(8, 8)
fn flipy(@builtin(global_invocation_id) id : vec3<u32>) {
    let dstSize = textureDimensions(dst).xy;
    if (id.x >= dstSize.x || id.y >= dstSize.y) {
        return;
    }

    let uv = (vec2f(f32(id.x), f32(dstSize.y - 1u - id.y)) + vec2f(0.5)) / vec2f(dstSize);
    var color = textureSampleLevel(src, smp, uv, 0);

    if (params.colorMode == COLOR_SRGB) {
        color = linear_to_srgb_vec4(color);
    } else if (params.colorMode == COLOR_NORMAL) {
        color = normalize_vec4(color);
    }

    textureStore(dst, id.xy, color);
}

// Fullscreen vertex shader
struct VSOutput {
	@builtin(position) pos: vec4<f32>,
	@location(0) tex : vec2<f32>
};

@vertex
fn fullscreen_vs(@builtin(vertex_index) vertexIndex : u32) -> VSOutput {

	var pos = array<vec2<f32>, 4>(
		vec2<f32>(-1.0,  1.0),
		vec2<f32>( 1.0,  1.0),
		vec2<f32>(-1.0, -1.0),
		vec2<f32>( 1.0, -1.0)
	);

	var tex = array<vec2<f32>, 4>(
		vec2<f32>(0.0, 0.0),
		vec2<f32>(1.0, 0.0),
		vec2<f32>(0.0, 1.0),
		vec2<f32>(1.0, 1.0)
	);

	var vs_output : VSOutput;
	vs_output.tex = tex[vertexIndex];
	vs_output.pos = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
	return vs_output;
}

@fragment
fn mipmap_fs(@location(0) uv : vec2<f32>) -> @location(0) vec4<f32> {

    // Instead of using level 0, we could pass the level as an argument, and reuse the same bindgroup
    // for all mipmaps.
    var color = textureSampleLevel(src, smp, uv, 0);

    if (params.colorMode == 2) {
        color = normalize_vec4(color);
    }

	return color;
}

@fragment
fn resize_fs(@location(0) uv : vec2<f32>) -> @location(0) vec4<f32> {

    var color = textureSample(src, smp, uv);

    if (params.colorMode == 2) {
        color = normalize_vec4(color);
    }

    return color;
}

@fragment
fn flipy_fs(@location(0) uv : vec2<f32>) -> @location(0) vec4<f32> {

    var color = textureSample(src, smp, vec2(uv.x, 1 - uv.y));

    if (params.colorMode == 2) {
        color = normalize_vec4(color);
    }

    return color;
}


@group(0) @binding(1) var<storage, read_write> global_counters: array<atomic<u32>, 3>;

var<workgroup> local_opaque: atomic<u32>;
var<workgroup> local_grayscale: atomic<u32>;
var<workgroup> local_invalid_normals: atomic<u32>;

@compute @workgroup_size(8, 8)
fn detect_channel_count(@builtin(global_invocation_id) global_id: vec3<u32>,
        @builtin(local_invocation_index) local_id: u32) {

    if (local_id == 0u) {
        atomicStore(&local_opaque, 1u);
        atomicStore(&local_grayscale, 1u);
        atomicStore(&local_invalid_normals, 0u);
    }
    workgroupBarrier();

    let tex_size = textureDimensions(src);
    if (global_id.x < tex_size.x && global_id.y < tex_size.y) {

        let color = textureLoad(src, vec2<i32>(global_id.xy), 0);

        // Alpha check
        if (color.a < 1.0) {
            atomicStore(&local_opaque, 0u);
        }

        // Grayscale check
        if (color.r != color.g || color.g != color.b) {
            atomicStore(&local_grayscale, 0u);
        }

        // Normal check
        let n = color.rgb * 2.0 - vec3(1.0);
        let len = length(n);

        if (abs(len - 1.0) > 0.2 || n.z < -0.1) {
            atomicAdd(&local_invalid_normals, 1u);
        }
    }

    workgroupBarrier();

    if (local_id == 0u) {
        // If not opaque, write not-opaque flag.
        if (atomicLoad(&local_opaque) == 0u) {
            atomicStore(&global_counters[0], 1u);
        }

        // If not greyscale, write not greyscale flag.
        if (atomicLoad(&local_grayscale) == 0u) {
            atomicStore(&global_counters[1], 1u);
        }

        // Add number of texels that are not normal.
        atomicAdd(&global_counters[2], atomicLoad(&local_invalid_normals));
    }
}


// @@ Compute RMSE?
