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
type Renderer = { draw: (scene: Scene) => void; dispose: () => void };
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
varying vec3 vColor;
varying float vAlpha;
varying float vGlow;
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
    float sx = aSeed.x;
    float sy = aSeed.y;
    if (aSeed.w > .28) {
      float lane = floor(aSeed.z * 3.);
      float ribbon = .2 + lane * .27 + sin(sx * 5.4 + lane * 2.3 + t * .028) * .16;
      float spread = (aSeed.y - .5) * (aSeed.y - .5) * sign(aSeed.y - .5);
      sy = fract(ribbon + spread * .65 + 1.);
    }
    p = vec2(sx, sy) * uResolution;
    p += vec2(sin(t*.055 + aSeed.z*TAU), cos(t*.04+aSeed.x*TAU)) * (3. + aSeed.w*9.);
    p += uTilt * (6. + pow(aSeed.z,2.) * 30.);
    vec2 difference = p - uPointer;
    float reach = exp(-dot(difference,difference)/38000.) * uActivity;
    p += vec2(-difference.y,difference.x) * reach * .07;
    p += clamp(uVelocity,vec2(-500.),vec2(500.)) * reach * .017;
    alpha = (.2 + pow(aSeed.w, 3.) * .65) * (.8 + sin(t*.65+aSeed.z*80.)*.2);
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
    if (aSeed.z > .989) { size += 2.; glow = .6; }
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
  } else if (aKind < 2.5) {
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
  } else {
    // A restrained bloom behind the granular core.
    p = uCenter + uTilt * uRadius * .22;
    size = uRadius * 2.8;
    alpha = .15;
    glow = 1.;
    color = vec3(.68,.68,.94);
  }
  gl_Position = vec4(p.x/uResolution.x*2.-1., 1.-p.y/uResolution.y*2., 0., 1.);
  gl_PointSize = min(uMaxPoint, max(1., size*uDpr));
  vAlpha = clamp(alpha,0.,1.);
  vColor = color;
  vGlow = glow;
}`;

const fragmentSource = `
precision mediump float;
varying vec3 vColor;
varying float vAlpha;
varying float vGlow;
void main() {
  float r = length(gl_PointCoord - .5) * 2.;
  if (r > 1.) discard;
  float shape = mix(1.-smoothstep(.35,1.,r), exp(-r*r*5.)*(1.-smoothstep(.6,1.,r)),vGlow);
  gl_FragColor = vec4(vColor, shape * vAlpha);
}`;

function createWebGLRenderer(canvas: HTMLCanvasElement, mobile: boolean): Renderer | null {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
  if (!gl) return null;
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
  const counts = mobile ? [9000, 7000, 1800, 1] : [20000, 22000, 4000, 1];
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
  const random = randomGenerator(432);
  const stars = Array.from({length: 2800}, () => [random(),random(),random(),random()]);
  return {
    draw(scene) {
      const {width,height,dpr,time,x,y,radius} = scene;
      context.setTransform(dpr,0,0,dpr,0,0);
      context.clearRect(0,0,width,height);
      context.fillStyle = '#dcdfff';
      stars.forEach(([a,b,c,d],index) => {
        const core = index > 1700;
        const angle = a*Math.PI*2+time*.07;
        const r = radius*Math.sqrt(b)*(1+Math.sin(angle*4+time*.5)*.13);
        const sx = core ? x+Math.cos(angle)*r*Math.cos(scene.tiltX*.4)+Math.sin(angle)*r*.2*scene.tiltX : a*width+scene.tiltX*(6+c*20);
        const sy = core ? y+Math.sin(angle)*r*Math.cos(scene.tiltY*.32) : b*height+scene.tiltY*(6+c*20);
        context.globalAlpha = core ? .22+c*.55 : .1+c*.45;
        context.fillRect(sx,sy,.5+d,.5+d);
      });
      scene.wakes.forEach(wake => {
        const age = time-wake.born;
        if (age<=0 || age>=2.4) return;
        const radius=65+age*60;
        const glow=context.createRadialGradient(wake.x,wake.y,0,wake.x,wake.y,radius);
        glow.addColorStop(0,'rgba(170,190,235,.16)');glow.addColorStop(1,'rgba(100,120,180,0)');
        context.globalAlpha=Math.pow(1-age/2.4,2)*wake.power;
        context.fillStyle=glow;context.fillRect(wake.x-radius,wake.y-radius,radius*2,radius*2);
      });
      context.globalAlpha=1;
    },
    dispose() {},
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
    } catch {
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
      catch {
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
      scene.dpr=Math.min(devicePixelRatio||1,pointerMode.matches?1.5:1.25);
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
      catch { setUseFallback(true); }
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
