struct Params {
    colorMode: u32,
};

@group(0) @binding(0) var src : texture_2d<f32>;
@group(0) @binding(1) var dst : texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var smp: sampler;
@group(0) @binding(3) var<uniform> params: Params;

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

    // We are not doing this yet, but in some cases we want to take 4 samples in order to apply alpha weighting,
    // or to support non multiple of two textures.
    let uv0 = (vec2f(id.xy) + vec2f(0.25)) * size_rcp;
    let uv1 = uv0 + 0.5 * size_rcp;

    var color = vec4f(0.0);
    color += textureSampleLevel(src, smp, vec2f(uv0.x, uv0.y), 0);
    color += textureSampleLevel(src, smp, vec2f(uv1.x, uv0.y), 0);
    color += textureSampleLevel(src, smp, vec2f(uv0.x, uv1.y), 0);
    color += textureSampleLevel(src, smp, vec2f(uv1.x, uv1.y), 0);
    color *= 0.25;

    // This would be the single sample implementation:
    // let uv = (vec2f(id.xy) + vec2f(0.5)) * size_rcp;
    // var color = textureSampleLevel(src, smp, vec2f(uv.x, uv.y), 0);

    if (params.colorMode == 1) {
        color = linear_to_srgb_vec4(color);
    } else if (params.colorMode == 2) {
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

    if (params.colorMode == 1) {
        color = linear_to_srgb_vec4(color);
    } else if (params.colorMode == 2) {
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

    if (params.colorMode == 1) {
        color = linear_to_srgb_vec4(color);
    } else if (params.colorMode == 2) {
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

	var pos = array< vec2<f32>, 4 >(
		vec2<f32>(-1.0,  1.0),
		vec2<f32>( 1.0,  1.0),
		vec2<f32>(-1.0, -1.0),
		vec2<f32>( 1.0, -1.0)
	);

	var tex = array< vec2<f32>, 4 >(
		vec2<f32>(0.0, 0.0),
		vec2<f32>(1.0, 0.0),
		vec2<f32>(0.0, 1.0),
		vec2<f32>(1.0, 1.0)
	);

	var vs_output : VSOutput;
	vs_output.tex = tex[ vertexIndex ];
	vs_output.pos = vec4<f32>( pos[ vertexIndex ], 0.0, 1.0 );
	return vs_output;
}

@fragment
fn mipmap_fs(@location(0) uv : vec2<f32>) -> @location(0) vec4<f32> {

    var color = textureSample(src, smp, uv);

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
