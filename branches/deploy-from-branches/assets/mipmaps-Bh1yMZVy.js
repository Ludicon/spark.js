import"./utils-muNxmGmb.js";import{S as w}from"./spark-eqDjPhLn.js";import"./preload-helper-56FapS8O.js";const b=`
          <div style="padding: 2em; font-family: sans-serif; max-width: 600px; margin: 5em auto; text-align: center;">
            <h1>WebGPU Not Supported</h1>
            <p>This demo requires a browser with WebGPU support.</p>
            <p>Please try using <strong>Chrome</strong> or <strong>Edge</strong> with WebGPU enabled, or a recent version of <strong>Safari</strong> on macOS.</p>
            <p>More information: <a href="https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API" target="_blank">MDN: WebGPU API</a></p>
          </div>
        `;async function E(){if(!navigator.gpu)throw document.body.innerHTML=b,new Error("WebGPU not supported");let e=null;try{e=await navigator.gpu.requestAdapter()}catch(f){console.error("Error while requesting WebGPU adapter:",f)}if(!e)throw document.body.innerHTML=b,new Error("No appropriate GPUAdapter found");const i=w.getRequiredFeatures(e),o=await e.requestDevice({requiredFeatures:i}),c=document.createElement("canvas");document.body.appendChild(c);const u=c.getContext("webgpu"),n=navigator.gpu.getPreferredCanvasFormat();return u.configure({device:o,format:n,alphaMode:"opaque"}),{device:o,context:u,canvasFormat:n}}const U=`
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
        fn main(@location(0) position: vec2f, @location(1) texCoord: vec2f) -> VertexOutput
        {
          var output: VertexOutput;

          // Scale the position to maintain 2:1 aspect ratio
          let aspect = 0.5 * (uniforms.textureHeight * uniforms.canvasWidth) / (uniforms.canvasHeight * uniforms.textureWidth);

          let scale = vec2f(
            min(1.0, 1.0 / aspect),
            max(-1.0, -aspect));
          let scaledPos = position * scale;

          output.position = vec4f(scaledPos, 0.0, 1.0);
          output.texCoord = texCoord;
          return output;
        }
        `,G=`
        @group(0) @binding(1) var t_diffuse: texture_2d<f32>;
        @group(0) @binding(2) var s_diffuse: sampler;

        fn linear_to_srgb_vec3(c: vec3<f32>) -> vec3<f32> {
            return select(
                1.055 * pow(c, vec3<f32>(1.0 / 2.4)) - 0.055,
                c * 12.92,
                c <= vec3<f32>(0.0031308)
            );
        }

        @fragment
        fn main(@location(0) texCoord: vec2f) -> @location(0) vec4f {

          // Display the first 7 mipmaps.
          var color = vec3f(0.0);
          if (texCoord.x < 1.0/2.0) {
              color = textureSampleLevel(t_diffuse, s_diffuse, vec2f(2 * texCoord.x, texCoord.y), 1.0).xyz;
          }
          else if (texCoord.x < 3.0/4.0 && texCoord.y < 1.0/2.0) {
            color = textureSampleLevel(t_diffuse, s_diffuse, vec2f(4 * texCoord.x - 2, 2 * texCoord.y), 2.0).xyz;
          }
          else if (texCoord.x < 7.0/8.0 && texCoord.y < 1.0/4.0) {
            color = textureSampleLevel(t_diffuse, s_diffuse, vec2f(8 * texCoord.x - 6, 4 * texCoord.y), 3.0).xyz;
          }
          else if (texCoord.x < 15.0/16.0 && texCoord.y < 1.0/8.0) {
            color = textureSampleLevel(t_diffuse, s_diffuse, vec2f(16 * texCoord.x - 14, 8 * texCoord.y), 4.0).xyz;
          }
          else if (texCoord.x < 31.0/32.0 && texCoord.y < 1.0/16.0) {
            color = textureSampleLevel(t_diffuse, s_diffuse, vec2f(32 * texCoord.x - 30, 16 * texCoord.y), 5.0).xyz;
          }
          else if (texCoord.x < 63.0/64.0 && texCoord.y < 1.0/32.0) {
            color = textureSampleLevel(t_diffuse, s_diffuse, vec2f(64 * texCoord.x - 62, 32 * texCoord.y), 6.0).xyz;
          }
          else if (texCoord.x < 127.0/128.0 && texCoord.y < 1.0/64.0) {
            color = textureSampleLevel(t_diffuse, s_diffuse, vec2f(128 * texCoord.x - 126, 64 * texCoord.y), 7.0).xyz;
          }

          color = linear_to_srgb_vec3(color);

          return vec4f(color, 1.0);
        }
        `;function _(e){const i=new Float32Array([-1,-1,0,0,1,-1,1,0,-1,1,0,1,1,1,1,1]),o=e.createBuffer({size:i.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});return e.queue.writeBuffer(o,0,i),o}async function F(){const{device:e,context:i,canvasFormat:o}=await E(),c=await w.create(e,{preload:["rgb"],verbose:!0,useTimestampQueries:!0}),u=_(e),n=e.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),f="./assets/paint.png",l=document.getElementById("status"),p=document.getElementById("mipmapFilter");let a,m;async function x(r){l.textContent="Encoding...";try{e.pushErrorScope("validation"),e.pushErrorScope("internal"),a=await c.encodeTexture(f,{format:"rgb",srgb:!0,mips:!0,mipmapFilter:r})}finally{const d=await e.popErrorScope(),h=await e.popErrorScope();d&&console.error("WebGPU Validation error:",d.message),h&&console.error("WebGPU Internal error:",h.message)}const t=await c.getTimeElapsed();t?(l.textContent=`Encoded in ${t.toFixed(2)} ms`,console.log(`GPU time: ${t.toFixed(2)} ms`)):l.textContent="Encoded",m=e.createBindGroup({layout:g,entries:[{binding:0,resource:{buffer:n}},{binding:1,resource:a.createView()},{binding:2,resource:C}]});const s=new Float32Array([window.innerWidth,window.innerHeight,a.width,a.height]);e.queue.writeBuffer(n,0,s)}const C=e.createSampler({magFilter:"linear",minFilter:"linear"}),g=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}]}),P=e.createPipelineLayout({bindGroupLayouts:[g]}),S=e.createRenderPipeline({layout:P,vertex:{module:e.createShaderModule({code:U}),entryPoint:"main",buffers:[{arrayStride:16,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"float32x2"}]}]},fragment:{module:e.createShaderModule({code:G}),entryPoint:"main",targets:[{format:o}]},primitive:{topology:"triangle-strip",stripIndexFormat:"uint32"}});await x(p.value),p.addEventListener("change",async r=>{await x(r.target.value)});function v(){const r=window.innerWidth,t=window.innerHeight,s=document.querySelector("canvas");if(s.width!==r||s.height!==t){s.width=r,s.height=t;const d=new Float32Array([r,t,a.width,a.height]);e.queue.writeBuffer(n,0,d)}}window.addEventListener("resize",v),v();function y(){const r=e.createCommandEncoder(),t=r.beginRenderPass({colorAttachments:[{view:i.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:"clear",storeOp:"store"}]});t.setPipeline(S),t.setBindGroup(0,m),t.setVertexBuffer(0,u),t.draw(4,1,0,0),t.end(),e.queue.submit([r.finish()]),requestAnimationFrame(y)}y()}F().catch(e=>{console.error("Error initializing WebGPU:",e)});
