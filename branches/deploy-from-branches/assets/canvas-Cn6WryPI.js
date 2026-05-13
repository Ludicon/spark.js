import"./utils-CnlaH6UJ.js";import{S as h}from"./spark-D1ZWJlBg.js";const m=`
          <div style="padding: 2em; font-family: sans-serif; max-width: 600px; margin: 5em auto; text-align: center;">
            <h1>WebGPU Not Supported</h1>
            <p>This demo requires a browser with WebGPU support.</p>
          </div>
        `;async function w(){if(!navigator.gpu)throw document.body.innerHTML=m,new Error("WebGPU not supported");const e=await navigator.gpu.requestAdapter();if(!e)throw document.body.innerHTML=m,new Error("No appropriate GPUAdapter found");const o=h.getRequiredFeatures(e),t=await e.requestDevice({requiredFeatures:o}),r=document.createElement("canvas");document.body.appendChild(r);const a=r.getContext("webgpu"),i=navigator.gpu.getPreferredCanvasFormat();return a.configure({device:t,format:i,alphaMode:"opaque"}),{device:t,context:a,canvasFormat:i}}function S(e=512){const o=document.createElement("canvas");o.width=e,o.height=e;const t=o.getContext("2d"),r=t.createLinearGradient(0,0,e,e);r.addColorStop(0,"#ff3366"),r.addColorStop(.5,"#ffaa22"),r.addColorStop(1,"#3366ff"),t.fillStyle=r,t.fillRect(0,0,e,e),t.strokeStyle="rgba(255,255,255,0.6)",t.lineWidth=2;for(let a=0;a<12;a++)t.beginPath(),t.arc(e/2,e/2,20+a*18,0,Math.PI*2),t.stroke();return t.fillStyle="white",t.font="bold 64px sans-serif",t.textAlign="center",t.textBaseline="middle",t.fillText("spark.js",e/2,e/2),o}const P=`
        struct Uniforms { canvasWidth: f32, canvasHeight: f32, textureWidth: f32, textureHeight: f32 }
        @group(0) @binding(0) var<uniform> uniforms: Uniforms;
        struct VertexOutput { @builtin(position) position: vec4f, @location(0) texCoord: vec2f }
        @vertex
        fn main(@location(0) position: vec2f, @location(1) texCoord: vec2f) -> VertexOutput {
          var output: VertexOutput;
          let aspect = (uniforms.textureHeight * uniforms.canvasWidth) / (uniforms.canvasHeight * uniforms.textureWidth);
          let scale = vec2f(min(1.0, 1.0 / aspect), max(-1.0, -aspect));
          output.position = vec4f(position * scale, 0.0, 1.0);
          output.texCoord = texCoord;
          return output;
        }`,G=`
        @group(0) @binding(1) var t_diffuse: texture_2d<f32>;
        @group(0) @binding(2) var s_diffuse: sampler;
        @fragment
        fn main(@location(0) texCoord: vec2f) -> @location(0) vec4f {
          return vec4f(textureSampleLevel(t_diffuse, s_diffuse, texCoord, 0.0).xyz, 1.0);
        }`;async function C(){const{device:e,context:o,canvasFormat:t}=await w(),r=await h.create(e,{preload:["rgb"],verbose:!0}),a=S(512),i=await r.encodeTexture(a,{srgb:!0}),c=new Float32Array([-1,-1,0,0,1,-1,1,0,-1,1,0,1,1,1,1,1]),d=e.createBuffer({size:c.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(d,0,c);const f=e.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),v=e.createSampler({magFilter:"linear",minFilter:"linear"}),p=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}]}),x=e.createPipelineLayout({bindGroupLayouts:[p]}),b=e.createBindGroup({layout:p,entries:[{binding:0,resource:{buffer:f}},{binding:1,resource:i.createView()},{binding:2,resource:v}]}),y=e.createRenderPipeline({layout:x,vertex:{module:e.createShaderModule({code:P}),entryPoint:"main",buffers:[{arrayStride:16,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"float32x2"}]}]},fragment:{module:e.createShaderModule({code:G}),entryPoint:"main",targets:[{format:t}]},primitive:{topology:"triangle-strip",stripIndexFormat:"uint32"}});function l(){const s=window.innerWidth,n=window.innerHeight,u=document.querySelector("canvas");(u.width!==s||u.height!==n)&&(u.width=s,u.height=n,e.queue.writeBuffer(f,0,new Float32Array([s,n,i.width,i.height])))}window.addEventListener("resize",l),l();function g(){const s=e.createCommandEncoder(),n=s.beginRenderPass({colorAttachments:[{view:o.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:"clear",storeOp:"store"}]});n.setPipeline(y),n.setBindGroup(0,b),n.setVertexBuffer(0,d),n.draw(4,1,0,0),n.end(),e.queue.submit([s.finish()]),requestAnimationFrame(g)}g()}C().catch(e=>console.error("Error:",e));
