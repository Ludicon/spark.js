import"./utils-muNxmGmb.js";import{S as C}from"./spark-gl-c7CSfKeD.js";import"./preload-helper-56FapS8O.js";const g=`
          <div style="padding: 2em; font-family: sans-serif; max-width: 600px; margin: 5em auto; text-align: center;">
            <h1>WebGL2 Not Supported</h1>
            <p>This demo requires a browser with WebGL2 support.</p>
            <p>Please try using a modern browser like <strong>Chrome</strong>, <strong>Firefox</strong>, <strong>Edge</strong>, or <strong>Safari</strong>.</p>
            <p>More information: <a href="https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API" target="_blank">MDN: WebGL API</a></p>
          </div>
        `;async function S(){const e=document.createElement("canvas");document.body.appendChild(e);const r=e.getContext("webgl2");if(!r)throw document.body.innerHTML=g,new Error("WebGL2 not supported");return{gl:r,canvas:e}}const y=`#version 300 es
        uniform vec2 uCanvasSize;
        uniform vec2 uTextureSize;

        in vec2 aPosition;
        in vec2 aTexCoord;

        out vec2 vTexCoord;

        void main() {
          // Scale the position to maintain 2:1 aspect ratio
          float aspect = 0.5 * (uTextureSize.y * uCanvasSize.x) / (uCanvasSize.y * uTextureSize.x);

          vec2 scale = vec2(
            min(1.0, 1.0 / aspect),
            max(-1.0, -aspect)
          );
          vec2 scaledPos = aPosition * scale;

          gl_Position = vec4(scaledPos, 0.0, 1.0);
          vTexCoord = aTexCoord;
        }
      `,b=`#version 300 es
        precision mediump float;

        uniform sampler2D uTexture;

        in vec2 vTexCoord;
        out vec4 fragColor;

        vec3 linear_to_srgb_vec3(vec3 c) {
          bvec3 cutoff = lessThanEqual(c, vec3(0.0031308));
          vec3 higher = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
          vec3 lower = c * 12.92;
          return mix(higher, lower, cutoff);
        }

        void main() {
          // Display the first 7 mipmaps
          vec3 color = vec3(0.0);

          if (vTexCoord.x < 1.0/2.0) {
            color = textureLod(uTexture, vec2(2.0 * vTexCoord.x, vTexCoord.y), 0.0).xyz;
          }
          else if (vTexCoord.x < 3.0/4.0 && vTexCoord.y < 1.0/2.0) {
            color = textureLod(uTexture, vec2(4.0 * vTexCoord.x - 2.0, 2.0 * vTexCoord.y), 1.0).xyz;
          }
          else if (vTexCoord.x < 7.0/8.0 && vTexCoord.y < 1.0/4.0) {
            color = textureLod(uTexture, vec2(8.0 * vTexCoord.x - 6.0, 4.0 * vTexCoord.y), 2.0).xyz;
          }
          else if (vTexCoord.x < 15.0/16.0 && vTexCoord.y < 1.0/8.0) {
            color = textureLod(uTexture, vec2(16.0 * vTexCoord.x - 14.0, 8.0 * vTexCoord.y), 3.0).xyz;
          }
          else if (vTexCoord.x < 31.0/32.0 && vTexCoord.y < 1.0/16.0) {
            color = textureLod(uTexture, vec2(32.0 * vTexCoord.x - 30.0, 16.0 * vTexCoord.y), 4.0).xyz;
          }
          else if (vTexCoord.x < 63.0/64.0 && vTexCoord.y < 1.0/32.0) {
            color = textureLod(uTexture, vec2(64.0 * vTexCoord.x - 62.0, 32.0 * vTexCoord.y), 5.0).xyz;
          }
          else if (vTexCoord.x < 127.0/128.0 && vTexCoord.y < 1.0/64.0) {
            color = textureLod(uTexture, vec2(128.0 * vTexCoord.x - 126.0, 64.0 * vTexCoord.y), 6.0).xyz;
          }

          color = linear_to_srgb_vec3(color);

          fragColor = vec4(color, 1.0);
        }
      `;function f(e,r,i){const o=e.createShader(r);if(e.shaderSource(o,i),e.compileShader(o),!e.getShaderParameter(o,e.COMPILE_STATUS)){const t=e.getShaderInfoLog(o);throw e.deleteShader(o),new Error(`Shader compilation failed: ${t}`)}return o}function L(e,r,i){const o=e.createProgram();if(e.attachShader(o,r),e.attachShader(o,i),e.linkProgram(o),!e.getProgramParameter(o,e.LINK_STATUS)){const t=e.getProgramInfoLog(o);throw e.deleteProgram(o),new Error(`Program linking failed: ${t}`)}return o}function w(e){const r=new Float32Array([-1,-1,0,0,1,-1,1,0,-1,1,0,1,1,1,1,1]),i=e.createBuffer();return e.bindBuffer(e.ARRAY_BUFFER,i),e.bufferData(e.ARRAY_BUFFER,r,e.STATIC_DRAW),i}async function A(){const{gl:e,canvas:r}=await S(),t=await C.create(e,{preload:["rgb"],verbose:!0}).encodeTexture("./assets/paint.png",{format:"rgb",srgb:!0,generateMipmaps:!0});console.log(`Encoded texture with ${t.mipmapCount} mip levels`);const l=w(e),s=f(e,e.VERTEX_SHADER,y),d=f(e,e.FRAGMENT_SHADER,b),n=L(e,s,d);e.deleteShader(s),e.deleteShader(d);const x=e.getAttribLocation(n,"aPosition"),u=e.getAttribLocation(n,"aTexCoord"),m=e.getUniformLocation(n,"uCanvasSize"),h=e.getUniformLocation(n,"uTextureSize"),p=e.getUniformLocation(n,"uTexture");e.bindBuffer(e.ARRAY_BUFFER,l),e.enableVertexAttribArray(x),e.vertexAttribPointer(x,2,e.FLOAT,!1,16,0),e.enableVertexAttribArray(u),e.vertexAttribPointer(u,2,e.FLOAT,!1,16,8);function v(){const a=window.innerWidth,c=window.innerHeight;(r.width!==a||r.height!==c)&&(r.width=a,r.height=c,e.viewport(0,0,a,c))}window.addEventListener("resize",v),v();function T(){e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),e.useProgram(n),e.uniform2f(m,r.width,r.height),e.uniform2f(h,t.width,t.height),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,t.texture),e.uniform1i(p,0),e.drawArrays(e.TRIANGLE_STRIP,0,4),requestAnimationFrame(T)}T()}A().catch(e=>{console.error("Error initializing WebGL:",e)});
