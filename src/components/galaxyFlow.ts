export type GalaxyFlowFrame = {
  width: number;
  height: number;
  dpr: number;
  time: number;
  pointerX: number;
  pointerY: number;
  velocityX: number;
  velocityY: number;
  activity: number;
  wakes: Array<{ x: number; y: number; born: number; power: number }>;
};

const fullscreenVertex = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * .5 + .5;
  gl_Position = vec4(aPosition, 0., 1.);
}`;

const flowFragment = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform vec2 uSize;
uniform float uTime;
uniform vec4 uPointer;
uniform vec2 uVelocity;
uniform vec4 uWakes[8];

// Continuous value noise keeps the material soft at the intentionally low resolution.
float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * .1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float noise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(hash(cell), hash(cell + vec2(1., 0.)), f.x),
             mix(hash(cell + vec2(0., 1.)), hash(cell + vec2(1., 1.)), f.x), f.y);
}
float cloud(vec2 p) {
  float result = noise(p) * .57;
  p = mat2(.8, -.6, .6, .8) * p * 2.07 + 13.1;
  result += noise(p) * .28;
  p = mat2(.8, -.6, .6, .8) * p * 2.03 + 7.3;
  return result + noise(p) * .15;
}
void main() {
  // Use top-left CSS coordinates so illumination follows the same pointer as the particles.
  vec2 pixel = vec2(vUv.x, 1. - vUv.y) * uSize;
  float scale = max(240., min(uSize.x, uSize.y));
  vec2 p = (pixel - uSize * .5) / scale;
  float time = uTime * .035;
  vec2 drift = vec2(time * .24, -time * .16);
  float speed = min(length(uVelocity) / 800., 1.);
  vec2 velocity = uVelocity / (length(uVelocity) + 100.);
  vec2 pointerDelta = (pixel - uPointer.xy) / scale;
  float pointerReach = exp(-dot(pointerDelta, pointerDelta) * 8.5) * uPointer.z;

  // A broad, gently sheared current under the cursor; it has no expanding circular edge.
  p += vec2(-pointerDelta.y, pointerDelta.x) * pointerReach * (.18 + speed * .22);
  p -= velocity * pointerReach * .09;
  float wakeLight = 0.;
  for (int i = 0; i < 8; i++) {
    vec4 wake = uWakes[i];
    float age = uTime - wake.z;
    if (age >= 0. && age < 3.6 && wake.w > 0.) {
      float life = pow(1. - age / 3.6, 2.);
      vec2 delta = (pixel - wake.xy) / scale;
      // Tilt wisps into the background flow rather than making concentric ripples.
      vec2 along = vec2(delta.x + delta.y * .72, delta.y - delta.x * .24);
      along += vec2(-age * .025, age * .016);
      float spread = .12 + age * .035;
      float influence = exp(-(along.x * along.x * .38 + along.y * along.y * 2.2) /
                            (spread * spread)) * life * wake.w;
      p += vec2(-delta.y, delta.x) * influence * .18;
      p += vec2(.03, -.018) * influence;
      wakeLight += influence;
    }
  }
  wakeLight = min(wakeLight, 1.5);

  vec2 q = p * 2.25 + drift;
  vec2 warp = vec2(cloud(q + vec2(0., time * .12)),
                   cloud(q + vec2(5.3, -time * .15)));
  float body = cloud(q + warp * 2.65 + vec2(-time * .14, 0.));
  float folds = .5 + .5 * sin((p.x * .48 + p.y * .9 + body * 1.3) * 13.);
  float ribbons = pow(folds, 5.);
  float veil = smoothstep(.25, .85, body);
  float halo = exp(-dot(pointerDelta, pointerDelta) * 4.5) * uPointer.z;
  float luminance = .003 + veil * .012 + ribbons * veil * .014;
  luminance += halo * (.006 + ribbons * .013) + wakeLight * (.008 + ribbons * .016);
  vec3 silver = mix(vec3(.73, .77, .92), vec3(.93, .95, 1.), body);
  vec3 color = vec3(.002, .0025, .004) + silver * luminance;
  gl_FragColor = vec4(color, 1.);
}`;

const compositeFragment = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTexture;
void main() { gl_FragColor = texture2D(uTexture, vUv); }
`;

/** A low-resolution flowing material underneath the independently rendered stardust. */
export function createGalaxyFlow(gl: WebGLRenderingContext): {
  draw: (scene: GalaxyFlowFrame) => void;
  dispose: () => void;
} {
  const shaders: WebGLShader[] = [];
  const programs: WebGLProgram[] = [];
  const buffers: WebGLBuffer[] = [];
  const textures: WebGLTexture[] = [];
  const framebuffers: WebGLFramebuffer[] = [];
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    framebuffers.forEach(value => gl.deleteFramebuffer(value));
    textures.forEach(value => gl.deleteTexture(value));
    buffers.forEach(value => gl.deleteBuffer(value));
    programs.forEach(value => gl.deleteProgram(value));
    shaders.forEach(value => gl.deleteShader(value));
  };
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Could not allocate galaxy flow shader');
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) ?? 'Galaxy flow shader compilation failed');
    }
    return shader;
  };
  const link = (fragment: string) => {
    const program = gl.createProgram();
    if (!program) throw new Error('Could not allocate galaxy flow program');
    programs.push(program);
    gl.attachShader(program, compile(gl.VERTEX_SHADER, fullscreenVertex));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? 'Galaxy flow shader link failed');
    }
    return program;
  };

  try {
    const flowProgram = link(flowFragment);
    const compositeProgram = link(compositeFragment);
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('Could not allocate galaxy flow geometry');
    buffers.push(buffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const flowPosition = gl.getAttribLocation(flowProgram, 'aPosition');
    const compositePosition = gl.getAttribLocation(compositeProgram, 'aPosition');
    const uniforms = {
      size: gl.getUniformLocation(flowProgram, 'uSize'),
      time: gl.getUniformLocation(flowProgram, 'uTime'),
      pointer: gl.getUniformLocation(flowProgram, 'uPointer'),
      velocity: gl.getUniformLocation(flowProgram, 'uVelocity'),
      wakes: gl.getUniformLocation(flowProgram, 'uWakes[0]'),
      texture: gl.getUniformLocation(compositeProgram, 'uTexture'),
    };
    const texture = gl.createTexture();
    if (!texture) throw new Error('Could not allocate galaxy flow texture');
    textures.push(texture);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) throw new Error('Could not allocate galaxy flow framebuffer');
    framebuffers.push(framebuffer);
    const wakeData = new Float32Array(8 * 4);
    let textureWidth = 0;
    let textureHeight = 0;
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    const bindGeometry = (position: number) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    };

    return {
      draw(scene) {
        if (disposed || scene.width <= 0 || scene.height <= 0) return;
        const ratio = Math.min(.5, 960 / scene.width, 640 / scene.height,
          maxTextureSize / scene.width, maxTextureSize / scene.height);
        const width = Math.max(1, Math.round(scene.width * ratio));
        const height = Math.max(1, Math.round(scene.height * ratio));
        gl.disable(gl.BLEND);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.SCISSOR_TEST);
        gl.disable(gl.STENCIL_TEST);
        gl.colorMask(true, true, true, true);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        if (textureWidth !== width || textureHeight !== height) {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
          if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            throw new Error('Galaxy flow framebuffer is incomplete');
          }
          textureWidth = width;
          textureHeight = height;
        }
        // The flow shader has no sampler; avoid leaving its render target bound for reading.
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.viewport(0, 0, width, height);
        gl.useProgram(flowProgram);
        bindGeometry(flowPosition);
        gl.uniform2f(uniforms.size, scene.width, scene.height);
        gl.uniform1f(uniforms.time, scene.time);
        gl.uniform4f(uniforms.pointer, scene.pointerX, scene.pointerY, Math.max(0, Math.min(1, scene.activity)), 0);
        gl.uniform2f(uniforms.velocity, scene.velocityX, scene.velocityY);
        for (let index = 0; index < 8; index++) {
          const wake = scene.wakes[index];
          wakeData.set(wake ? [wake.x, wake.y, wake.born, wake.power] : [0, 0, -100, 0], index * 4);
        }
        gl.uniform4fv(uniforms.wakes, wakeData);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.disableVertexAttribArray(flowPosition);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.useProgram(compositeProgram);
        bindGeometry(compositePosition);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(uniforms.texture, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.disableVertexAttribArray(compositePosition);
        gl.bindTexture(gl.TEXTURE_2D, null);
      },
      dispose,
    };
  } catch (error) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    dispose();
    throw error;
  }
}
