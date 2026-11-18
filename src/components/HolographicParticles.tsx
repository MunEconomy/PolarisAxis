import { useEffect, useRef, useState } from 'react';
import { createGalaxyFlow } from './galaxyFlow';

type Props = { paused?: boolean };
type Wake = { x: number; y: number; born: number; power: number };
type Scene = {
  width: number; height: number; dpr: number; time: number;
  x: number; y: number; radius: number; tiltX: number; tiltY: number;
  pointerX: number; pointerY: number; velocityX: number; velocityY: number;
  activity: number; wakes: Wake[];
};
type Renderer = { maxDpr?: number; draw: (scene: Scene) => void; dispose: () => void };
const WAKE_COUNT = 8;

function randomGenerator(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let n = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n;
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

const vertexSource = `
precision highp float;
attribute vec4 aSeed;
attribute float aKind;
uniform vec2 uResolution;
uniform vec2 uCenter;
uniform float uTime;
uniform float uRadius;
uniform vec2 uTilt;
uniform vec2 uPointer;
uniform vec2 uVelocity;
uniform float uActivity;
uniform float uDpr;
uniform float uMaxPoint;
uniform vec4 uWakes[8];
varying mediump vec3 vColor;
varying mediump float vAlpha;
varying mediump float vGlow;
const float TAU = 6.28318530718;
void main() {
  vec2 p;
  float size = 1.;
  float alpha = 1.;
  float glow = 0.;
  vec3 color = mix(vec3(.76,.83,1.), vec3(1.,.98,1.), aSeed.z);
  float t = uTime;
  if (aKind < .5) {
    // An unbounded star field, with several fine, slowly folding galactic ribbons.
    float sx = fract(aSeed.x + t * .0007 * (.3 + aSeed.z));
    float sy = aSeed.y;
    if (aSeed.w > .28) {
      float lane = floor(aSeed.z * 3.);
      float ribbon = .2 + lane * .27 + sin(sx * 5.4 + lane * 2.3 + t * .08) * .16;
      float spread = (aSeed.y - .5) * (aSeed.y - .5) * sign(aSeed.y - .5);
      sy = fract(ribbon + spread * .65 + 1.);
    }
    p = vec2(sx, sy) * uResolution;
    float bend = sin(sx*7.+t*.34)*25. + sin(sx*13.-t*.22)*12.;
    p += vec2(sin(t*.17)*16.,bend) * clamp(uResolution.y/950.,.65,1.2);
    p += vec2(sin(t*.2 + aSeed.z*TAU), cos(t*.16+aSeed.x*TAU)) * (3. + aSeed.w*9.);
    p += uTilt * (6. + pow(aSeed.z,2.) * 30.);
    vec2 difference = p - uPointer;
    float reach = exp(-dot(difference,difference)/38000.) * uActivity;
    p += vec2(-difference.y,difference.x) * reach * .07;
    p += clamp(uVelocity,vec2(-500.),vec2(500.)) * reach * .017;
    alpha = (.2 + pow(aSeed.w, 3.) * .65)
      * (.7 + sin(sx*6.-t*.65)*.16 + sin(t*.85+aSeed.z*80.)*.14);
    size = .9 + pow(aSeed.z, 8.) * 2.2;
    alpha += reach * .2;
    for (int i=0; i<8; i++) {
      vec4 wake = uWakes[i];
      float age = t - wake.z;
      if (age > 0. && age < 2.4) {
        vec2 diff = p - wake.xy;
        float reach = 100. + age * 45.;
        float influence = exp(-dot(diff,diff)/(reach*reach));
        float life = pow(1.-age/2.4,2.) * wake.w;
        p += vec2(-diff.y,diff.x) * influence * life * .16;
        alpha += influence * life * .14;
      }
    }
    if (aSeed.z > .989) {
      float glint = pow(.5+.5*sin(t*(.7+aSeed.w*.7)+aSeed.x*TAU),6.);
      size += 2. + glint*3.; glow = .7;
      alpha += glint * .65;
    }
  } else if (aKind < 1.5) {
    // The central sculpture stays anchored; mouse position controls its 3D pose.
    float angle = aSeed.x * TAU + t * (.03 + aSeed.w * .012);
    float z = aSeed.y * 2. - 1.;
    float ring = sqrt(max(0., 1.-z*z));
    vec3 sphere = vec3(cos(angle)*ring, z, sin(angle)*ring);
    float fold = 1. + sin(angle*3. + z*4. + t*.34)*.12 + cos(angle*5.-z*3.-t*.2)*.06;
    float yaw = uTilt.x * .42;
    float pitch = .24 + uTilt.y * .32;
    vec3 turned = vec3(sphere.x*cos(yaw)+sphere.z*sin(yaw),sphere.y,-sphere.x*sin(yaw)+sphere.z*cos(yaw));
    turned = vec3(turned.x,turned.y*cos(pitch)-turned.z*sin(pitch),turned.y*sin(pitch)+turned.z*cos(pitch));
    float roll = uTilt.x * .1;
    vec2 shape = mat2(cos(roll),sin(roll),-sin(roll),cos(roll)) * turned.xy;
    float depth = aSeed.w < .28 ? .4 + aSeed.w * 1.8 : 1.;
    float perspective = 1. / (1. - turned.z * .13);
    p = uCenter + shape * uRadius * fold * depth * perspective;
    vec3 light = normalize(vec3(uTilt.x * .85,-uTilt.y * .7,1.));
    float highlight = pow(max(0.,dot(normalize(turned),light)),5.);
    float edge = pow(1.-abs(turned.z),3.);
    alpha = (.2 + aSeed.z*.44 + edge*.24 + highlight*.5) * (.9 + .1*sin(aSeed.w*100.+t*.45));
    size = .9 + pow(aSeed.z,4.)*1.5 + highlight*.25;
    color = mix(vec3(.58,.64,.82),vec3(1.,.99,1.),.35 + highlight*.55 + edge*.1);
    if (aSeed.z > .997) { size = 3.5; glow = .5; }
  } else {
    vec4 wake = vec4(0.,0.,-100.,0.);
    float index = floor(aSeed.x * 8.);
    for (int i=0; i<8; i++) { if (float(i) == index) wake = uWakes[i]; }
    float age = t - wake.z;
    float life = max(0.,1.-age/2.4);
    float angle = aSeed.y*TAU + age*.24;
    float radius = sqrt(aSeed.z) * (30. + age*80.);
    vec2 diffuse = vec2(cos(angle)*1.6,sin(angle)*.7) * radius;
    p = wake.xy + diffuse;
    alpha = age > 0. && age < 2.4 ? pow(life,2.)*wake.w*(1.-aSeed.z)*.45 : 0.;
    size = .8+aSeed.w*.9;
    color = vec3(.72,.78,.94);
  }
  gl_Position = vec4(p.x/uResolution.x*2.-1., 1.-p.y/uResolution.y*2., 0., 1.);
  gl_PointSize = min(uMaxPoint, max(1., size*uDpr));
  vAlpha = clamp(alpha,0.,1.);
  vColor = color;
  vGlow = glow;
}`;

const fragmentSource = `
precision mediump float;
varying mediump vec3 vColor;
varying mediump float vAlpha;
varying mediump float vGlow;
void main() {
  float r = length(gl_PointCoord - .5) * 2.;
  if (r > 1.) discard;
  float shape = mix(1.-smoothstep(.35,1.,r), exp(-r*r*5.)*(1.-smoothstep(.6,1.,r)),vGlow);
  gl_FragColor = vec4(vColor, shape * vAlpha);
}`;

function createWebGLRenderer(canvas: HTMLCanvasElement, mobile: boolean): Renderer | null {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
  if (!gl) {
    console.warn('[Polaris] WebGL is unavailable; using Canvas fallback.');
    return null;
  }
  const shaders: WebGLShader[] = [];
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'Galaxy shader compilation failed');
    shaders.push(shader);
    return shader;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Galaxy shader link failed');
  gl.useProgram(program);
  const random = randomGenerator(104084);
  const counts = mobile ? [9000, 7000, 1800] : [20000, 22000, 4000];
  const count = counts.reduce((sum, value) => sum + value, 0);
  const data = new Float32Array(count * 5);
  let offset = 0;
  counts.forEach((amount, kind) => {
    for (let i = 0; i < amount; i++) {
      data[offset++] = random(); data[offset++] = random(); data[offset++] = random(); data[offset++] = random(); data[offset++] = kind;
    }
  });
  const buffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  const seed = gl.getAttribLocation(program, 'aSeed');
  const kind = gl.getAttribLocation(program, 'aKind');
  gl.enableVertexAttribArray(seed); gl.vertexAttribPointer(seed, 4, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(kind); gl.vertexAttribPointer(kind, 1, gl.FLOAT, false, 20, 16);
  const uniforms = Object.fromEntries(['uResolution','uCenter','uTime','uRadius','uTilt','uPointer','uVelocity','uActivity','uDpr','uMaxPoint','uWakes[0]'].map(name => [name, gl.getUniformLocation(program,name)]));
  const wakeData = new Float32Array(WAKE_COUNT * 4);
  const flow = createGalaxyFlow(gl);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.disable(gl.DEPTH_TEST);
  const maxPoint = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1];
  return {
    draw(scene) {
      flow.draw(scene);
      gl.viewport(0,0,canvas.width,canvas.height);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.enableVertexAttribArray(seed); gl.vertexAttribPointer(seed,4,gl.FLOAT,false,20,0);
      gl.enableVertexAttribArray(kind); gl.vertexAttribPointer(kind,1,gl.FLOAT,false,20,16);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
      gl.uniform2f(uniforms.uResolution,scene.width,scene.height);
      gl.uniform2f(uniforms.uCenter,scene.x,scene.y);
      gl.uniform1f(uniforms.uTime,scene.time); gl.uniform1f(uniforms.uRadius,scene.radius);
      gl.uniform2f(uniforms.uTilt,scene.tiltX,scene.tiltY);
      gl.uniform2f(uniforms.uPointer,scene.pointerX,scene.pointerY);
      gl.uniform2f(uniforms.uVelocity,scene.velocityX,scene.velocityY);
      gl.uniform1f(uniforms.uActivity,scene.activity);
      gl.uniform1f(uniforms.uDpr,scene.dpr);
      gl.uniform1f(uniforms.uMaxPoint,maxPoint);
      scene.wakes.forEach((wake,index) => { wakeData.set([wake.x,wake.y,wake.born,wake.power],index*4); });
      gl.uniform4fv(uniforms['uWakes[0]'],wakeData);
      gl.drawArrays(gl.POINTS,0,count);
    },
    dispose() { flow.dispose(); gl.deleteBuffer(buffer); gl.deleteProgram(program); shaders.forEach(shader => gl.deleteShader(shader)); },
  };
}

function createCanvasRenderer(canvas: HTMLCanvasElement): Renderer | null {
  const context = canvas.getContext('2d');
  if (!context) return null;
  const tau = Math.PI * 2;
  const random = randomGenerator(104084);
  // Cache the fine dust, then bend and illuminate it in narrow strips each frame.
  // This gives software rendering a flowing field without redrawing 20,000 stars.
  const field = document.createElement('canvas');
  const fieldContext = field.getContext('2d', { alpha: false });
  if (!fieldContext) return null;
  const padding = 96;
  let fieldWidth = 0, fieldHeight = 0;
  let disposed = false;
  const stars = Array.from({length: 20000}, () => [random(), random(), random(), random()]);
  const core = Array.from({length: 4800}, () => {
    const a = random(), b = random(), c = random(), d = random();
    const z = b * 2 - 1;
    return { angle: a * tau, z, ring: Math.sqrt(1 - z * z), light: c,
      phase: d * 100, speed: .03 + d * .012, depth: d < .28 ? .4 + d * 1.8 : 1,
      size: 1.23 + c * c * c * c * 1.35, sparkle: c > .997 };
  });
  const dust = Array.from({length: 96}, () => ({angle: random() * tau, spread: random(), size: .65 + random() * .9}));
  const glints = Array.from({length: 520}, () => ({
    x: random(), y: random(), depth: random(), phase: random() * tau,
    lane: Math.floor(random() * 3), speed: .7 + random() * .7,
  }));
  const silver = Array.from({length: 32}, (_, index) => {
    const mix = index / 31;
    return `rgb(${Math.round((.58 + .42 * mix) * 255)},${Math.round((.64 + .35 * mix) * 255)},${Math.round((.82 + .18 * mix) * 255)})`;
  });
  const bloom = document.createElement('canvas');
  bloom.width = bloom.height = 96;
  const bloomContext = bloom.getContext('2d');
  if (bloomContext) {
    const gradient = bloomContext.createRadialGradient(48, 48, 0, 48, 48, 48);
    gradient.addColorStop(0, 'rgba(174,174,240,.55)');
    gradient.addColorStop(.22, 'rgba(174,174,240,.31)');
    gradient.addColorStop(.55, 'rgba(154,164,226,.055)');
    gradient.addColorStop(1, 'rgba(154,164,226,0)');
    bloomContext.fillStyle = gradient;
    bloomContext.fillRect(0, 0, 96, 96);
  }

  function cacheField(width: number, height: number, dpr: number) {
    fieldWidth = width; fieldHeight = height;
    const scale = Math.min(dpr, 1.15, 1920 / (width + padding * 2), 1080 / (height + padding * 2));
    field.width = Math.max(1, Math.round((width + padding * 2) * scale));
    field.height = Math.max(1, Math.round((height + padding * 2) * scale));
    fieldContext!.setTransform(scale, 0, 0, scale, padding * scale, padding * scale);
    fieldContext!.globalAlpha = 1;
    fieldContext!.globalCompositeOperation = 'source-over';
    fieldContext!.fillStyle = '#010102';
    fieldContext!.fillRect(-padding, -padding, width + padding * 2, height + padding * 2);
    fieldContext!.globalCompositeOperation = 'lighter';
    // A low-key silver veil underneath the same three sinusoidal galactic lanes.
    for (let lane = 0; lane < 3; lane++) {
      for (let index = -1; index <= 20; index++) {
        const sx = index / 20;
        const sy = .2 + lane * .27 + Math.sin(sx * 5.4 + lane * 2.3) * .16;
        const hazeSize = Math.max(110, Math.min(270, height * .33));
        fieldContext!.globalAlpha = .014;
        fieldContext!.drawImage(bloom, sx * width - hazeSize, sy * height - hazeSize * .55, hazeSize * 2, hazeSize * 1.1);
      }
    }
    const count = width < 768 ? 9000 : stars.length;
    for (let index = 0; index < count; index++) {
      const [a, b, c, d] = stars[index];
      let sy = b;
      if (d > .28) {
        const lane = Math.floor(c * 3);
        const ribbon = .2 + lane * .27 + Math.sin(a * 5.4 + lane * 2.3) * .16;
        const spread = (b - .5) * Math.abs(b - .5);
        sy = (ribbon + spread * .65 + 1) % 1;
      }
      const sx = a * width;
      const py = sy * height;
      const c2 = c * c, c4 = c2 * c2;
      const size = .7 + c4 * c4 * 1.7;
      fieldContext!.fillStyle = c > .55 ? '#f2f0ff' : '#c4d4f5';
      // Populate the overscan too, so drifting never reveals an empty screen edge.
      for (let wrapY = -1; wrapY <= 1; wrapY++) {
        const drawY = py + wrapY * height;
        if (drawY < -padding || drawY > height + padding) continue;
        for (let wrapX = -1; wrapX <= 1; wrapX++) {
          const drawX = sx + wrapX * width;
          if (drawX < -padding || drawX > width + padding) continue;
          fieldContext!.globalAlpha = (.2 + d * d * d * .65) * .82;
          fieldContext!.fillRect(drawX - size / 2, drawY - size / 2, size, size);
          if (c > .989) {
            fieldContext!.globalAlpha = .44;
            fieldContext!.drawImage(bloom, drawX - 4.5, drawY - 4.5, 9, 9);
          }
        }
      }
    }
    fieldContext!.globalAlpha = 1;
    fieldContext!.globalCompositeOperation = 'source-over';
  }

  return {
    draw(scene) {
      const {width,height,dpr,time,x,y,radius} = scene;
      if (disposed || width <= 0 || height <= 0) return;
      if (width !== fieldWidth || height !== fieldHeight) cacheField(width, height, dpr);
      context.setTransform(dpr,0,0,dpr,0,0);
      // Keep cached stars, glow and live particles in independent blend states.
      context.globalAlpha = 1;
      context.globalCompositeOperation = 'source-over';
      context.fillStyle = '#010102';
      context.fillRect(0,0,width,height);
      const driftX = scene.tiltX * 12 + Math.sin(time * .17) * 16;
      const driftY = scene.tiltY * 12;
      const scaleX = field.width / (width + padding * 2);
      const scaleY = field.height / (height + padding * 2);
      const stripCount = Math.ceil(width / 12);
      const amplitude = Math.min(1.2, Math.max(.65, height / 950));
      for (let strip = 0; strip < stripCount; strip++) {
        // Align the strips to backing pixels to avoid hairline seams at fractional DPR.
        const left = Math.round(strip * width / stripCount * dpr) / dpr;
        const right = Math.round((strip + 1) * width / stripCount * dpr) / dpr;
        const nx = (left + right) * .5 / width;
        const bend = (Math.sin(nx * 7 + time * .34) * 25
          + Math.sin(nx * 13 - time * .22) * 12) * amplitude;
        context.globalAlpha = 1;
        context.drawImage(field,
          (padding + left - driftX) * scaleX, (padding - driftY - bend) * scaleY,
          (right - left) * scaleX, height * scaleY,
          left, 0, right - left, height);
      }
      context.globalCompositeOperation = 'lighter';
      // Independent veils drift through the fine field, lending a soft pearly depth.
      for (let veil = 0; veil < 4; veil++) {
        const phase = veil * 1.9;
        const vx = width * (.14 + veil * .24 + Math.sin(time * .12 + phase) * .07);
        const vy = height * (.5 + Math.sin(time * .16 + phase) * .27);
        const size = Math.min(340, width * .32);
        context.globalAlpha = .035 + (.5 + .5 * Math.sin(time * .42 + phase)) * .035;
        context.drawImage(bloom, vx - size, vy - size * .5, size * 2, size);
      }
      // A smaller live layer glides at different depths and catches intermittent light.
      const glintCount = width < 768 ? 220 : glints.length;
      context.fillStyle = '#e4eaff';
      for (let index = 0; index < glintCount; index++) {
        const star = glints[index];
        const nx = (star.x + time * .003 * star.speed) % 1;
        const ribbon = .2 + star.lane * .27 + Math.sin(nx * 5.4 + star.lane * 2.3 + time * .18) * .16;
        const spread = (star.y - .5) * Math.abs(star.y - .5) * .65;
        const sy = index % 4 === 0 ? star.y : (ribbon + spread + 1) % 1;
        const sx = nx * width + scene.tiltX * (12 + star.depth * 24);
        const py = sy * height + Math.sin(time * .27 + star.phase) * 14 + scene.tiltY * 18;
        const pulse = Math.pow(.5 + .5 * Math.sin(time * star.speed + star.phase), 6);
        const edgeFade = Math.min(1, nx * 35, (1 - nx) * 35);
        const size = .65 + star.depth * .95 + pulse * .6;
        context.globalAlpha = (.12 + star.depth * .16 + pulse * .46) * edgeFade;
        context.fillRect(sx - size / 2, py - size / 2, size, size);
        if (index % 7 === 0) {
          const glowSize = 7 + star.depth * 10 + pulse * 8;
          context.globalAlpha = pulse * .65 * edgeFade;
          context.drawImage(bloom, sx - glowSize / 2, py - glowSize / 2, glowSize, glowSize);
        }
      }
      const bloomSize = radius * 2.8;
      context.globalAlpha = .22;
      context.drawImage(bloom, x + scene.tiltX * radius * .22 - bloomSize / 2,
        y + scene.tiltY * radius * .22 - bloomSize / 2, bloomSize, bloomSize);

      const yaw = scene.tiltX * .42, pitch = .24 + scene.tiltY * .32, roll = scene.tiltX * .1;
      const yawCos = Math.cos(yaw), yawSin = Math.sin(yaw);
      const pitchCos = Math.cos(pitch), pitchSin = Math.sin(pitch);
      const rollCos = Math.cos(roll), rollSin = Math.sin(roll);
      const lightX = scene.tiltX * .85, lightY = -scene.tiltY * .7;
      const lightLength = Math.hypot(lightX, lightY, 1);
      const coreCount = width < 768 ? 3200 : core.length;
      for (let index = 0; index < coreCount; index++) {
        const particle = core[index];
        const angle = particle.angle + time * particle.speed;
        const sphereX = Math.cos(angle) * particle.ring;
        const sphereZ = Math.sin(angle) * particle.ring;
        const turnedX = sphereX * yawCos + sphereZ * yawSin;
        const yawZ = -sphereX * yawSin + sphereZ * yawCos;
        const turnedY = particle.z * pitchCos - yawZ * pitchSin;
        const turnedZ = particle.z * pitchSin + yawZ * pitchCos;
        const fold = 1 + Math.sin(angle * 3 + particle.z * 4 + time * .34) * .12
          + Math.cos(angle * 5 - particle.z * 3 - time * .2) * .06;
        const perspective = 1 / (1 - turnedZ * .13);
        const distance = radius * fold * particle.depth * perspective;
        const sx = x + (turnedX * rollCos - turnedY * rollSin) * distance;
        const sy = y + (turnedX * rollSin + turnedY * rollCos) * distance;
        const lit = Math.max(0, (turnedX * lightX + turnedY * lightY + turnedZ) / lightLength);
        const lit2 = lit * lit;
        const highlight = lit2 * lit2 * lit;
        const rim = 1 - Math.abs(turnedZ);
        const edge = rim * rim * rim;
        const shimmer = .9 + .1 * Math.sin(particle.phase + time * .45);
        const shade = Math.min(31, Math.round((.35 + highlight * .55 + edge * .1) * 31));
        context.fillStyle = silver[shade];
        context.globalAlpha = Math.min(1, (.2 + particle.light * .44 + edge * .24 + highlight * .5) * shimmer);
        // Slightly larger grains compensate for the lower CPU particle count while
        // retaining the shader's shaded shell, folded outline and interior depth.
        const size = particle.size + highlight * .2;
        context.fillRect(sx - size / 2, sy - size / 2, size, size);
        if (particle.sparkle) {
          context.globalAlpha *= .8;
          context.drawImage(bloom, sx - 4, sy - 4, 8, 8);
        }
      }

      context.fillStyle = '#bac8f0';
      scene.wakes.forEach(wake => {
        const age = time-wake.born;
        if (age<=0 || age>=2.4 || wake.power <= 0) return;
        const remaining = 1 - age / 2.4;
        const life = remaining * remaining * wake.power;
        const spread = 30 + age * 80;
        context.globalAlpha = life * .08;
        context.drawImage(bloom, wake.x - spread * 1.8, wake.y - spread * .75, spread * 3.6, spread * 1.5);
        for (const mote of dust) {
          const angle = mote.angle + age * .24;
          const distance = Math.sqrt(mote.spread) * spread;
          const sx = wake.x + Math.cos(angle) * distance * 1.6;
          const sy = wake.y + Math.sin(angle) * distance * .7;
          context.globalAlpha = life * (1 - mote.spread) * .65;
          context.fillRect(sx, sy, mote.size, mote.size);
        }
      });
      context.globalAlpha=1;
      context.globalCompositeOperation='source-over';
      context.fillStyle='#dcdfff';
    },
    // Limit software rasterization cost on Retina displays without changing CSS size.
    maxDpr: 1.25,
    dispose() { disposed = true; field.width = field.height = bloom.width = bloom.height = 1; },
  };
}

/** The background is generated live: every star and the luminous core is a particle. */
export function HolographicParticles({ paused = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [useFallback, setUseFallback] = useState(false);
  const pausedRef = useRef(paused);
  const playbackRef = useRef<(() => void) | null>(null);
  useEffect(() => { pausedRef.current=paused; playbackRef.current?.(); },[paused]);

  useEffect(() => {
    const canvas=canvasRef.current;
    const hero=canvas?.closest<HTMLElement>('.hero');
    if (!canvas || !hero) return;
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointerMode=window.matchMedia('(hover: hover) and (pointer: fine)');
    let renderer: Renderer | null;
    try {
      renderer = useFallback ? createCanvasRenderer(canvas) : createWebGLRenderer(canvas,!pointerMode.matches) ?? createCanvasRenderer(canvas);
    } catch (error) {
      console.warn('[Polaris] WebGL initialization failed; using Canvas fallback.', error);
      // A canvas with an acquired WebGL context cannot switch to 2D; remount it.
      canvas.getContext('webgl')?.getExtension('WEBGL_lose_context')?.loseContext();
      setUseFallback(true);
      return;
    }
    if (!renderer) return;
    let frame=0, previous=0, inView=false, lost=false, disposed=false;
    let active=false, targetX=.5, targetY=.55, wakeIndex=0, lastWake=-1;
    const scene:Scene={width:1,height:1,dpr:1,time:0,x:0,y:0,radius:160,tiltX:0,tiltY:0,pointerX:0,pointerY:0,velocityX:0,velocityY:0,activity:0,wakes:Array.from({length:WAKE_COUNT},()=>({x:0,y:0,born:-100,power:0}))};
    const canPlay=()=>!disposed&&!lost&&!pausedRef.current&&!motion.matches&&inView&&!document.hidden;
    const draw=()=>{
      try { renderer?.draw(scene); }
      catch (error) {
        console.warn('[Polaris] WebGL drawing failed; using Canvas fallback.', error);
        // A failed GPU render target must not interrupt the surrounding page.
        lost=true;
        cancelAnimationFrame(frame);
        if (!useFallback) setUseFallback(true);
      }
    };
    const tick=(now:number)=>{
      frame=0;
      if (!canPlay()) return;
      const fps=pointerMode.matches?60:30;
      const delta=previous?now-previous:1000/fps;
      if (delta>=1000/fps-.5) {
        const dt=Math.min(delta,50)/1000;
        previous=now;scene.time+=dt;
        const tiltEase=1-Math.exp(-dt*5.5);
        scene.tiltX+=((active?(targetX-.5)*2:0)-scene.tiltX)*tiltEase;
        scene.tiltY+=((active?(targetY-.5)*2:0)-scene.tiltY)*tiltEase;
        scene.x=scene.width*.5+scene.tiltX*Math.min(28,scene.width*.025);
        scene.y=scene.height*.56+scene.tiltY*Math.min(20,scene.height*.025);
        const dx=targetX*scene.width-scene.pointerX,dy=targetY*scene.height-scene.pointerY;
        const follow=1-Math.exp(-dt*12);
        scene.pointerX+=dx*follow;scene.pointerY+=dy*follow;
        const velocityEase=1-Math.exp(-dt*7);
        scene.velocityX+=((active?dx*follow/dt:0)-scene.velocityX)*velocityEase;
        scene.velocityY+=((active?dy*follow/dt:0)-scene.velocityY)*velocityEase;
        scene.activity+=((active?1:0)-scene.activity)*(1-Math.exp(-dt*4));
        const speed=Math.min(1,Math.hypot(scene.velocityX,scene.velocityY)/800);
        if (active && speed>.035 && scene.time-lastWake>.1) {
          scene.wakes[wakeIndex]={x:scene.pointerX,y:scene.pointerY,born:scene.time,power:Math.min(1,speed*.9+.1)};
          wakeIndex=(wakeIndex+1)%WAKE_COUNT;lastWake=scene.time;
        }
        draw();
      }
      frame=requestAnimationFrame(tick);
    };
    const updatePlayback=()=>{
      cancelAnimationFrame(frame);frame=0;previous=0;
      if(motion.matches){active=false;scene.x=scene.width*.5;scene.y=scene.height*.56;scene.tiltX=0;scene.tiltY=0;scene.activity=0;scene.velocityX=0;scene.velocityY=0;scene.wakes.forEach(r=>r.born=-100);draw();}
      if(canPlay())frame=requestAnimationFrame(tick);
    };
    const resize=()=>{
      const bounds=canvas.getBoundingClientRect();
      const oldWidth=scene.width,oldHeight=scene.height;
      scene.width=bounds.width;scene.height=bounds.height;
      scene.dpr=Math.min(devicePixelRatio||1,pointerMode.matches?1.5:1.25,renderer?.maxDpr??Infinity);
      canvas.width=Math.round(scene.width*scene.dpr);canvas.height=Math.round(scene.height*scene.dpr);
      scene.radius=Math.min(220,Math.max(88,scene.width*.14));
      scene.x=oldWidth>1?scene.x/oldWidth*scene.width:scene.width*.5;
      scene.y=oldHeight>1?scene.y/oldHeight*scene.height:scene.height*.56;
      scene.pointerX=scene.width*.5;scene.pointerY=scene.height*.56;scene.velocityX=0;scene.velocityY=0;
      scene.wakes.forEach(r=>r.born=-100);draw();updatePlayback();
    };
    const move=(event:PointerEvent)=>{
      if(!canPlay()||!pointerMode.matches||event.pointerType==='touch')return;
      const bounds=canvas.getBoundingClientRect();
      targetX=Math.max(0,Math.min(1,(event.clientX-bounds.left)/bounds.width));
      targetY=Math.max(0,Math.min(1,(event.clientY-bounds.top)/bounds.height));
      active=true;
    };
    const leave=()=>{active=false;};
    const onContextLost=(event:Event)=>{event.preventDefault();lost=true;updatePlayback();};
    const onContextRestored=()=>{
      // Context loss already releases GPU objects; old handles are invalid after restoration.
      try { renderer=createWebGLRenderer(canvas,!pointerMode.matches);lost=false;resize(); }
      catch (error) { console.warn('[Polaris] WebGL restoration failed.', error); setUseFallback(true); }
    };
    const onPointerModeChange=()=>{active=false;scene.tiltX=0;scene.tiltY=0;resize();};
    const resizeObserver=new ResizeObserver(resize);
    const intersection=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;if(!inView)active=false;updatePlayback();});
    playbackRef.current=updatePlayback;
    resizeObserver.observe(canvas);intersection.observe(canvas);
    hero.addEventListener('pointermove',move,{passive:true});hero.addEventListener('pointerleave',leave);
    window.addEventListener('blur',leave);document.addEventListener('visibilitychange',updatePlayback);
    motion.addEventListener('change',updatePlayback);pointerMode.addEventListener('change',onPointerModeChange);
    canvas.addEventListener('webglcontextlost',onContextLost);canvas.addEventListener('webglcontextrestored',onContextRestored);
    resize();
    return()=>{
      disposed=true;cancelAnimationFrame(frame);playbackRef.current=null;
      resizeObserver.disconnect();intersection.disconnect();renderer?.dispose();
      hero.removeEventListener('pointermove',move);hero.removeEventListener('pointerleave',leave);
      window.removeEventListener('blur',leave);document.removeEventListener('visibilitychange',updatePlayback);
      motion.removeEventListener('change',updatePlayback);pointerMode.removeEventListener('change',onPointerModeChange);
      canvas.removeEventListener('webglcontextlost',onContextLost);canvas.removeEventListener('webglcontextrestored',onContextRestored);
    };
  },[useFallback]);
  return <canvas key={useFallback ? 'fallback' : 'webgl'} ref={canvasRef} className="hero__interactive-dust" aria-hidden="true" style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}} />;
}
