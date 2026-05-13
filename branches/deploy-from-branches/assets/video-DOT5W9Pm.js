import"./utils-CnlaH6UJ.js";import{S as v}from"./spark-D1ZWJlBg.js";const g=`
          <div style="padding: 2em; font-family: sans-serif; max-width: 600px; margin: 5em auto; text-align: center;">
            <h1>WebGPU Not Supported</h1>
            <p>This demo requires a browser with WebGPU support.</p>
            <p>Please try using <strong>Chrome</strong> or <strong>Edge</strong> with WebGPU enabled, or a recent version of <strong>Safari</strong> on macOS.</p>
            <p>More information: <a href="https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API" target="_blank">MDN: WebGPU API</a></p>
          </div>
        `;async function U(){if(!navigator.gpu)throw document.body.innerHTML=g,new Error("WebGPU not supported");let e=null;try{e=await navigator.gpu.requestAdapter()}catch(c){console.error("Error while requesting WebGPU adapter:",c)}if(!e)throw document.body.innerHTML=g,new Error("No appropriate GPUAdapter found");const t=v.getRequiredFeatures(e),r=await e.requestDevice({requiredFeatures:t}),o=document.createElement("canvas");document.body.appendChild(o);const s=o.getContext("webgpu"),n=navigator.gpu.getPreferredCanvasFormat();return s.configure({device:r,format:n,alphaMode:"opaque"}),{device:r,context:s,canvasFormat:n}}const G=`
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
        `,S=`
        @group(0) @binding(1) var t_diffuse: texture_2d<f32>;
        @group(0) @binding(2) var s_diffuse: sampler;

        @fragment
        fn main(@location(0) texCoord: vec2f) -> @location(0) vec4f {
          var color = textureSampleLevel(t_diffuse, s_diffuse, texCoord, 0.0).xyz;

          return vec4f(color, 1.0);
        }
        `;function E(e){const t=new Float32Array([-1,-1,0,0,1,-1,1,0,-1,1,0,1,1,1,1,1]),r=e.createBuffer({size:t.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});return e.queue.writeBuffer(r,0,t),r}function B(e){const t=document.createElement("video");return t.src=e,t.crossOrigin="anonymous",t.muted=!0,t.loop=!0,t.playsInline=!0,new Promise((r,o)=>{t.addEventListener("loadeddata",()=>r(t),{once:!0}),t.addEventListener("error",()=>o(new Error("Failed to load video")),{once:!0}),t.play().catch(o)})}async function F(){const{device:e,context:t,canvasFormat:r}=await U(),o=await v.create(e,{preload:["rgb"],verbose:!0,cacheTempResources:!0}),s=E(e),n=e.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),h=await B("https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4");let a;const b=e.createSampler({magFilter:"linear",minFilter:"linear"}),d=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}]}),x=e.createPipelineLayout({bindGroupLayouts:[d]}),w=e.createRenderPipeline({layout:x,vertex:{module:e.createShaderModule({code:G}),entryPoint:"main",buffers:[{arrayStride:16,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"float32x2"}]}]},fragment:{module:e.createShaderModule({code:S}),entryPoint:"main",targets:[{format:r}]},primitive:{topology:"triangle-strip",stripIndexFormat:"uint32"}}),u=document.querySelector("canvas");function f(){u.width=window.innerWidth,u.height=window.innerHeight}window.addEventListener("resize",f),f();async function l(){const p=new VideoFrame(h);try{a=await o.encodeTexture(p,{format:"rgb",mips:!1,outputTexture:a})}finally{p.close()}const y=new Float32Array([u.width,u.height,a.width,a.height]);e.queue.writeBuffer(n,0,y);const P=e.createBindGroup({layout:d,entries:[{binding:0,resource:{buffer:n}},{binding:1,resource:a.createView()},{binding:2,resource:b}]}),m=e.createCommandEncoder(),i=m.beginRenderPass({colorAttachments:[{view:t.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:"clear",storeOp:"store"}]});i.setPipeline(w),i.setBindGroup(0,P),i.setVertexBuffer(0,s),i.draw(4,1,0,0),i.end(),e.queue.submit([m.finish()]),requestAnimationFrame(l)}l()}F().catch(e=>{console.error("Error initializing WebGPU:",e)});
