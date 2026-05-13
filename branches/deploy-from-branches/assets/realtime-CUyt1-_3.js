import"./utils-muNxmGmb.js";import{S as U}from"./spark-eqDjPhLn.js";import"./preload-helper-56FapS8O.js";const y=`
          <div style="padding: 2em; font-family: sans-serif; max-width: 600px; margin: 5em auto; text-align: center;">
            <h1>WebGPU Not Supported</h1>
            <p>This demo requires a browser with WebGPU support.</p>
            <p>Please try using <strong>Chrome</strong> or <strong>Edge</strong> with WebGPU enabled, or a recent version of <strong>Safari</strong> on macOS.</p>
            <p>More information: <a href="https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API" target="_blank">MDN: WebGPU API</a></p>
          </div>
        `;async function _(){if(!navigator.gpu)throw document.body.innerHTML=y,new Error("WebGPU not supported");let e=null;try{e=await navigator.gpu.requestAdapter()}catch(n){console.error("Error while requesting WebGPU adapter:",n)}if(!e)throw document.body.innerHTML=y,new Error("No appropriate GPUAdapter found");const i=U.getRequiredFeatures(e),t=await e.requestDevice({requiredFeatures:i}),d=document.createElement("canvas");document.body.appendChild(d);const f=d.getContext("webgpu"),r=navigator.gpu.getPreferredCanvasFormat();return f.configure({device:t,format:r,alphaMode:"opaque"}),{device:t,context:f,canvasFormat:r}}const L=`
        @group(0) @binding(0) var dst: texture_storage_2d<rgba8unorm, write>;

        struct Uniforms {
          time: f32,
          width: f32,
          height: f32,
        }
        @group(0) @binding(1) var<uniform> uniforms: Uniforms;

        const PI: f32 = 3.14159265;

        @compute @workgroup_size(16, 16, 1)
        fn main(@builtin(global_invocation_id) gid: vec3u) {
          let uv = vec2f(gid.xy) / vec2f(uniforms.width, uniforms.height);

          let t = uniforms.time * 10.0;
          let vp = vec2f(512.0, 512.0);

          let p0 = (uv - 0.5) * vp;
          let hvp = vp * 0.5;
          let p1d = vec2f(cos(t / 98.0), sin(t / 178.0)) * hvp - p0;
          let p2d = vec2f(sin(-t / 124.0), cos(-t / 104.0)) * hvp - p0;
          let p3d = vec2f(cos(-t / 165.0), cos(t / 45.0)) * hvp - p0;

          let sum = 0.5 + 0.5 * (
            cos(length(p1d) / 30.0) +
            cos(length(p2d) / 20.0) +
            sin(length(p3d) / 25.0) * sin(p3d.x / 20.0) * sin(p3d.y / 15.0)
          );

          let i = fract(sum);
          let t2 = (64.0 * uniforms.time) / vec3f(63.0, 78.0, 45.0);
          var cs = cos(i * PI * 2.0 + vec3f(0.0, 1.0, -0.5) * PI + t2);
          cs = 0.5 * cs + 0.5;

          textureStore(dst, gid.xy, vec4f(cs, cs.x));
        }
      `,M=`
        struct Uniforms {
          canvasWidth: f32,
          canvasHeight: f32,
          textureWidth: f32,
          textureHeight: f32,
        }
        @group(0) @binding(0) var<uniform> uniforms: Uniforms;

        struct VertexOutput {
          @builtin(position) position: vec4f,
          @location(0) texCoord: vec2f,
        }

        @vertex
        fn main(@location(0) position: vec2f,
                @location(1) texCoord: vec2f) -> VertexOutput {
          var output: VertexOutput;

          // Scale the position to maintain 1:1 aspect ratio
          let aspect = (uniforms.textureHeight * uniforms.canvasWidth) / (uniforms.canvasHeight * uniforms.textureWidth);

          let scale = vec2f(
            min(1.0, 1.0 / aspect),
            max(-1.0, -aspect));
          let scaledPos = position * scale;

          output.position = vec4f(scaledPos, 0.0, 1.0);
          output.texCoord = texCoord;
          return output;
        }
      `,F=`
        @group(0) @binding(1) var t_diffuse: texture_2d<f32>;
        @group(0) @binding(2) var s_diffuse: sampler;

        @fragment
        fn main(@location(0) texCoord: vec2f) -> @location(0) vec4f {
          var color = textureSampleLevel(t_diffuse, s_diffuse, texCoord, 0.0).xyz;
          return vec4f(color, 1.0);
        }
      `;function O(e){const i=new Float32Array([-1,-1,0,0,1,-1,1,0,-1,1,0,1,1,1,1,1]),t=e.createBuffer({size:i.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});return e.queue.writeBuffer(t,0,i),t}async function q(){const{device:e,context:i,canvasFormat:t}=await _(),d=await U.create(e,{preload:["rgb"],cacheTempResources:!0}),f=O(e),r=1024,n=1024,l=e.createTexture({size:[r,n,1],format:"rgba8unorm",usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC}),m=e.createBuffer({size:12,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),g=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:"write-only",format:"rgba8unorm"}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]}),w=e.createPipelineLayout({bindGroupLayouts:[g]}),G=e.createComputePipeline({layout:w,compute:{module:e.createShaderModule({code:L}),entryPoint:"main"}}),S=e.createBindGroup({layout:g,entries:[{binding:0,resource:l.createView()},{binding:1,resource:{buffer:m}}]}),v=e.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),B=e.createSampler({magFilter:"linear",minFilter:"linear"}),h=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}]}),T=e.createPipelineLayout({bindGroupLayouts:[h]}),C=e.createRenderPipeline({layout:T,vertex:{module:e.createShaderModule({code:M}),entryPoint:"main",buffers:[{arrayStride:16,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"float32x2"}]}]},fragment:{module:e.createShaderModule({code:F}),entryPoint:"main",targets:[{format:t}]},primitive:{topology:"triangle-strip",stripIndexFormat:"uint32"}});function b(){const s=window.innerWidth,u=window.innerHeight,o=document.querySelector("canvas");if(o.width!==s||o.height!==u){o.width=s,o.height=u;const a=new Float32Array([s,u,r,n]);e.queue.writeBuffer(v,0,a)}}window.addEventListener("resize",b),b();let E=performance.now(),p;async function P(){const s=(performance.now()-E)/1e3,u=new Float32Array([s,r,n]);e.queue.writeBuffer(m,0,u);const o=e.createCommandEncoder(),a=o.beginComputePass();a.setPipeline(G),a.setBindGroup(0,S),a.dispatchWorkgroups(Math.ceil(r/16),Math.ceil(n/16),1),a.end(),e.queue.submit([o.finish()]),p=await d.encodeTexture(l,{format:"rgb",mips:!1,outputTexture:p});const W=e.createBindGroup({layout:h,entries:[{binding:0,resource:{buffer:v}},{binding:1,resource:p.createView()},{binding:2,resource:B}]}),x=e.createCommandEncoder(),c=x.beginRenderPass({colorAttachments:[{view:i.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:"clear",storeOp:"store"}]});c.setPipeline(C),c.setBindGroup(0,W),c.setVertexBuffer(0,f),c.draw(4,1,0,0),c.end(),e.queue.submit([x.finish()]),requestAnimationFrame(P)}P()}q().catch(e=>{console.error("Error initializing WebGPU:",e)});
