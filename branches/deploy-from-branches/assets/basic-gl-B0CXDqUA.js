import"./utils-muNxmGmb.js";import{S as L}from"./spark-gl-c7CSfKeD.js";import"./preload-helper-56FapS8O.js";function a(r){const e=document.createElement("div");e.id="error",e.innerHTML=`
          <h1>Error</h1>
          <p>${r}</p>
        `,document.body.appendChild(e)}async function C(){const r=document.getElementById("glCanvas"),e=r.getContext("webgl2",{antialias:!1,depth:!1,stencil:!1});if(!e){a("WebGL2 is not supported. Please use a modern browser.");return}r.width=window.innerWidth,r.height=window.innerHeight;const s=L.create(e,{preload:["rgb"],verbose:!0}),c=s.getSupportedFormats();if(console.log("Supported formats:",c),c.length===0){a("No compressed texture formats are supported on this device. Please try a different browser or device.");return}const f="./assets/kodim23.avif";let i;try{i=await s.encodeTexture(f),console.log("Compressed texture:",i)}catch(n){a(`Failed to compress texture: ${n.message}`),console.error(n);return}const h=`#version 300 es
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
        `,x=`#version 300 es
          precision mediump float;
          in vec2 vTexCoord;
          out vec4 fragColor;

          uniform sampler2D uTexture;

          void main() {
            fragColor = texture(uTexture, vTexCoord);
          }
        `;function d(n,_){const o=e.createShader(n);return e.shaderSource(o,_),e.compileShader(o),e.getShaderParameter(o,e.COMPILE_STATUS)?o:(console.error("Shader compile error:",e.getShaderInfoLog(o)),e.deleteShader(o),null)}const E=d(e.VERTEX_SHADER,h),g=d(e.FRAGMENT_SHADER,x),t=e.createProgram();if(e.attachShader(t,E),e.attachShader(t,g),e.linkProgram(t),!e.getProgramParameter(t,e.LINK_STATUS)){console.error("Program link error:",e.getProgramInfoLog(t));return}const p=new Float32Array([-1,-1,0,0,1,-1,1,0,-1,1,0,1,1,1,1,1]),u=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,u),e.bufferData(e.ARRAY_BUFFER,p,e.STATIC_DRAW);const m=e.getAttribLocation(t,"position"),T=e.getAttribLocation(t,"texCoord"),v=e.getUniformLocation(t,"uCanvasSize"),S=e.getUniformLocation(t,"uTextureSize"),R=e.getUniformLocation(t,"uTexture");function l(){e.viewport(0,0,r.width,r.height),e.clearColor(.1,.1,.1,1),e.clear(e.COLOR_BUFFER_BIT),e.useProgram(t),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,i.texture),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.uniform1i(R,0),e.uniform2f(v,r.width,r.height),e.uniform2f(S,i.width,i.height),e.bindBuffer(e.ARRAY_BUFFER,u),e.enableVertexAttribArray(m),e.vertexAttribPointer(m,2,e.FLOAT,!1,16,0),e.enableVertexAttribArray(T),e.vertexAttribPointer(T,2,e.FLOAT,!1,16,8),e.drawArrays(e.TRIANGLE_STRIP,0,4)}function A(){r.width=window.innerWidth,r.height=window.innerHeight,l()}window.addEventListener("resize",A),l()}C().catch(r=>{console.error("Initialization error:",r),a(`Initialization failed: ${r.message}`)});
