import"./utils-CnlaH6UJ.js";import{S as m}from"./spark-D1ZWJlBg.js";const g=`
        <div style="padding: 2em; font-family: sans-serif; max-width: 600px; margin: 5em auto; text-align: center;">
          <h1>WebGPU Not Supported</h1>
          <p>This demo requires a browser with WebGPU support.</p>
          <p>Please try using <strong>Chrome</strong> or <strong>Edge</strong> with WebGPU enabled, or a recent version of <strong>Safari</strong> on macOS.</p>
          <p>More information: <a href="https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API" target="_blank">MDN: WebGPU API</a></p>
        </div>
        `;async function w(){if(!navigator.gpu)throw document.body.innerHTML=g,new Error("WebGPU not supported");let e=null;try{e=await navigator.gpu.requestAdapter()}catch(d){console.error("Error while requesting WebGPU adapter:",d)}if(!e)throw document.body.innerHTML=g,new Error("No appropriate GPUAdapter found");const n=m.getRequiredFeatures(e),o=await e.requestDevice({requiredFeatures:n}),i=document.createElement("canvas");document.body.appendChild(i);const s=i.getContext("webgpu"),a=navigator.gpu.getPreferredCanvasFormat();return s.configure({device:o,format:a,alphaMode:"opaque"}),{device:o,context:s,canvasFormat:a}}const y=`
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
        `,U=`
        @group(0) @binding(1) var t_diffuse: texture_2d<f32>;
        @group(0) @binding(2) var s_diffuse: sampler;

        @fragment
        fn main(@location(0) texCoord: vec2f) -> @location(0) vec4f {
          var color = textureSampleLevel(t_diffuse, s_diffuse, texCoord, 0.0);

          var blendColor = mix(vec3f(0.5), color.rgb, color.a);

          return vec4f(blendColor, 1.0);
        }
        `;function G(e){const n=new Float32Array([-1,-1,0,0,1,-1,1,0,-1,1,0,1,1,1,1,1]),o=e.createBuffer({size:n.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});return e.queue.writeBuffer(o,0,n),o}async function S(){const{device:e,context:n,canvasFormat:o}=await w(),i=await m.create(e,{preload:["rgba"]}),s=G(e),a=e.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),d="./assets/Tiger.svg";let c;try{e.pushErrorScope("validation"),e.pushErrorScope("internal"),c=await i.encodeTexture(d,{format:"rgba"})}finally{const r=await e.popErrorScope(),t=await e.popErrorScope();r&&console.error("WebGPU Validation error:",r.message),t&&console.error("WebGPU Internal error:",t.message)}const v=e.createSampler({magFilter:"linear",minFilter:"linear"}),f=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}]}),h=e.createPipelineLayout({bindGroupLayouts:[f]}),b=e.createBindGroup({layout:f,entries:[{binding:0,resource:{buffer:a}},{binding:1,resource:c.createView()},{binding:2,resource:v}]}),x=e.createRenderPipeline({layout:h,vertex:{module:e.createShaderModule({code:y}),entryPoint:"main",buffers:[{arrayStride:16,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"float32x2"}]}]},fragment:{module:e.createShaderModule({code:U}),entryPoint:"main",targets:[{format:o}]},primitive:{topology:"triangle-strip",stripIndexFormat:"uint32"}});function p(){const r=window.innerWidth,t=window.innerHeight,u=document.querySelector("canvas");if(u.width!==r||u.height!==t){u.width=r,u.height=t;const P=new Float32Array([r,t,c.width,c.height]);e.queue.writeBuffer(a,0,P)}}window.addEventListener("resize",p),p();function l(){const r=e.createCommandEncoder(),t=r.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:"clear",storeOp:"store"}]});t.setPipeline(x),t.setBindGroup(0,b),t.setVertexBuffer(0,s),t.draw(4,1,0,0),t.end(),e.queue.submit([r.finish()]),requestAnimationFrame(l)}l()}S().catch(e=>{console.error("Error initializing WebGPU:",e)});
