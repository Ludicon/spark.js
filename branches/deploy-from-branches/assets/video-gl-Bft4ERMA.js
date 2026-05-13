import"./utils-muNxmGmb.js";import{S as _}from"./spark-gl-c7CSfKeD.js";import"./preload-helper-56FapS8O.js";function c(r){const e=document.createElement("div");e.id="error",e.innerHTML=`
          <h1>Error</h1>
          <p>${r}</p>
        `,document.body.appendChild(e)}function w(r){const e=document.createElement("video");return e.src=r,e.crossOrigin="anonymous",e.muted=!0,e.loop=!0,e.playsInline=!0,new Promise((s,a)=>{e.addEventListener("loadeddata",()=>s(e),{once:!0}),e.addEventListener("error",()=>a(new Error("Failed to load video")),{once:!0}),e.play().catch(a)})}async function C(){const r=document.getElementById("glCanvas"),e=r.getContext("webgl2",{antialias:!1,depth:!1,stencil:!1});if(!e){c("WebGL2 is not supported. Please use a modern browser.");return}r.width=window.innerWidth,r.height=window.innerHeight;const s=_.create(e,{preload:["rgb"],verbose:!0,cacheTempResources:!0}),a=s.getSupportedFormats();if(console.log("Supported formats:",a),a.length===0){c("No compressed texture formats are supported on this device. Please try a different browser or device.");return}const p="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";let d;try{d=await w(p)}catch(o){c(`Failed to load video: ${o.message}`),console.error(o);return}let n;const v=`#version 300 es
          in vec2 position;
          in vec2 texCoord;
          out vec2 vTexCoord;

          uniform vec2 uCanvasSize;
          uniform vec2 uTextureSize;

          void main() {
            vTexCoord.x = texCoord.x;
            vTexCoord.y = 1.0 - texCoord.y;

            // Scale to maintain aspect ratio
            float aspect = (uTextureSize.y * uCanvasSize.x) / (uCanvasSize.y * uTextureSize.x);
            vec2 scale = vec2(
              min(1.0, 1.0 / aspect),
              min(1.0, aspect)
            );

            gl_Position = vec4(position * scale, 0.0, 1.0);
          }
        `,h=`#version 300 es
          precision mediump float;
          in vec2 vTexCoord;
          out vec4 fragColor;

          uniform sampler2D uTexture;

          void main() {
            fragColor = texture(uTexture, vTexCoord);
          }
        `;function u(o,L){const i=e.createShader(o);return e.shaderSource(i,L),e.compileShader(i),e.getShaderParameter(i,e.COMPILE_STATUS)?i:(console.error("Shader compile error:",e.getShaderInfoLog(i)),e.deleteShader(i),null)}const E=u(e.VERTEX_SHADER,v),x=u(e.FRAGMENT_SHADER,h),t=e.createProgram();if(e.attachShader(t,E),e.attachShader(t,x),e.linkProgram(t),!e.getProgramParameter(t,e.LINK_STATUS)){console.error("Program link error:",e.getProgramInfoLog(t));return}const g=new Float32Array([-1,-1,0,0,1,-1,1,0,-1,1,0,1,1,1,1,1]),l=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,l),e.bufferData(e.ARRAY_BUFFER,g,e.STATIC_DRAW);const m=e.getAttribLocation(t,"position"),T=e.getAttribLocation(t,"texCoord"),S=e.getUniformLocation(t,"uCanvasSize"),R=e.getUniformLocation(t,"uTextureSize"),A=e.getUniformLocation(t,"uTexture");async function f(){const o=new VideoFrame(d);try{n=await s.encodeTexture(o,{format:"rgb",mips:!1,outputTexture:n})}finally{o.close()}e.viewport(0,0,r.width,r.height),e.clearColor(.1,.1,.1,1),e.clear(e.COLOR_BUFFER_BIT),e.useProgram(t),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,n.texture),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.uniform1i(A,0),e.uniform2f(S,r.width,r.height),e.uniform2f(R,n.width,n.height),e.bindBuffer(e.ARRAY_BUFFER,l),e.enableVertexAttribArray(m),e.vertexAttribPointer(m,2,e.FLOAT,!1,16,0),e.enableVertexAttribArray(T),e.vertexAttribPointer(T,2,e.FLOAT,!1,16,8),e.drawArrays(e.TRIANGLE_STRIP,0,4),requestAnimationFrame(f)}window.addEventListener("resize",()=>{r.width=window.innerWidth,r.height=window.innerHeight}),f()}C().catch(r=>{console.error("Initialization error:",r),c(`Initialization failed: ${r.message}`)});
