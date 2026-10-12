/**
 * glass-x-scene.ts - real-time dispersive glass X (three.js r186)
 *
 * Ported from design-assets/web-x/src/glass-x.js. Animation, light studio and DEFAULTS are unchanged;
 * this file only adds types, the model URL under /brand, a `speed` option (default 1 = as designed) and
 * stricter cleanup. Never import it statically from app code: it pulls in three, so load it with
 * `import("./glass-x-scene")` (see glass-x-view.tsx).
 *
 *   const x = await mountGlassX(element, { background: '#101010' });
 *   x.restart();        // replay the 4 s reveal
 *   x.dispose();        // free GPU memory and release the WebGL context
 *
 * Mirrors the Blender scene: the X turns in from 32 deg, a burst of violet / blue / cyan light sweeps
 * across the glass, then everything dims to a dark glass X with a glowing violet outline.
 * The glass is three's MeshPhysicalMaterial (transmission + dispersion); the light "studio" is a tiny
 * scene of emissive strips baked to an environment map every frame during the reveal (PMREM).
 */
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const PALETTE = {
  deepViolet: 0x5927e8,
  electricPurple: 0x9b4dff,
  purple: 0x8030ff, // deeper purple used for the front-face band and the outline (reads purple, not pink)
  neonBlue: 0x246bff,
  cyanBlue: 0x38d9ff,
  softLavender: 0xc6a8ff,
};

export interface GlassXOptions {
  src: string;
  background: string | null; // CSS colour, or null for a transparent canvas (bloom is skipped then)
  duration: number;
  autoplay: boolean;
  replayOnClick: boolean;
  pointer: boolean;
  pointerYaw: number;
  pointerPitch: number;
  pointerSmooth: number;
  introYaw: number;
  introSeconds: number;
  peak: number;
  gain: number;
  faceHold: number;
  stripPeak: number;
  edgeBurst: number;
  dome: number;
  ghost: number;
  rim: number;
  bloom: number;
  roughness: number;
  endRoughness: number;
  highlightClamp: number;
  glintBloom: number;
  endBloom: number;
  bloomRadius: number;
  bloomThreshold: number;
  dispersion: number;
  fov: number;
  distance: number;
  speed: number;
}

export const DEFAULTS: GlassXOptions = {
  src: "/brand/glass_x.glb",
  background: "#000000", // CSS colour, or null for a transparent canvas (bloom is skipped then)
  duration: 4, // seconds of the reveal (matches the Blender clip)
  autoplay: true, // start when the element scrolls into view
  replayOnClick: true,
  pointer: true, // the X turns with the mouse
  pointerYaw: 26, // degrees of turn left/right at the window edge
  pointerPitch: 11, // degrees of tilt up/down
  pointerSmooth: 0.07, // 0..1, lower = heavier / more inertia
  introYaw: 38, // degrees the X is turned at t = 0
  introSeconds: 2.2, // time to turn front-on
  peak: 1.0, // brightest light level of the burst (1 = designed look)
  gain: 2.2, // overall strip brightness
  faceHold: 0.22, // level the front-surface colour lights (violet / teal) keep at the end
  stripPeak: 0.12, // how bright the broad strips get in the burst (the glints lead instead)
  edgeBurst: 3, // how strongly the bevelled edges flash during the burst
  dome: 0.035, // faint violet fill so the glass body reads as a ghost
  ghost: 0.28, // strip level after the reveal (low enough to stay calm, high enough that turning the X still catches glints)
  rim: 11.0, // strength of the outline glow
  bloom: 1.0, // bloom multiplier (0 = off)
  roughness: 0.03, // crisp glass during the light burst
  endRoughness: 0.09, // ...easing to a soft frosted glow at the end (dissolves the sparkles)
  highlightClamp: 0.5, // brightest value allowed before bloom (removes sparkles)
  glintBloom: 0.18, // soft glow around the travelling hot spots
  endBloom: 0.16, // bloom strength reached at the end (was 1.25)
  bloomRadius: 0.65, // size of the glow gradient
  bloomThreshold: 0.06, // lower = more of the outline blooms
  dispersion: 2.2, // MeshPhysicalMaterial.dispersion
  fov: 34, // wider lens = stronger perspective while the X turns (like the reference)
  distance: 13.2, // keeps the front-on X the same size as fov 24 / distance 19
  speed: 1, // playback rate of the reveal (everything is driven by one clock, so 2 = the same look in half the time)
};

/** Soft-clamps the brightest channel so single hot pixels cannot turn into sparkles / pin-point halos. */
const HighlightClamp = {
  uniforms: { tDiffuse: { value: null }, maxV: { value: 1.0 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader:
    "uniform sampler2D tDiffuse; uniform float maxV; varying vec2 vUv;" +
    "void main(){ vec4 c = texture2D(tDiffuse, vUv); float m = max(c.r, max(c.g, c.b));" +
    "if (m > maxV) c.rgb *= (maxV + (1.0 - exp(-(m - maxV)))) / m; gl_FragColor = c; }",
};

/** Removes isolated bright specks (1-2 px) but keeps lines and blobs: a pixel is replaced only if nothing
 *  within 2 px of it is comparably bright. Runs before the bloom, so specks never grow halos. */
const Despeckle = {
  uniforms: { tDiffuse: { value: null }, px: { value: new THREE.Vector2(1 / 1024, 1 / 1024) } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader:
    "uniform sampler2D tDiffuse; uniform vec2 px; varying vec2 vUv;" +
    "float L(vec4 c){ return max(c.r, max(c.g, c.b)); }" +
    "void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = L(c); float ring = 0.0;" +
    "for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) { if (max(abs(i), abs(j)) != 2) continue;" +
    "ring = max(ring, L(texture2D(tDiffuse, vUv + vec2(float(i), float(j)) * px))); }" +
    "if (l > 3.0 * ring + 0.03 && l < 1.0) c.rgb *= (ring * 1.2 + 0.01) / l; gl_FragColor = c; }",
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Flat-topped strip with a short feathered edge: the reflected shapes stay readable but not razor-hard. */
function softTexture() {
  const n = 128,
    c = document.createElement("canvas");
  c.width = c.height = n;
  const g = c.getContext("2d")!,
    img = g.createImageData(n, n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const u = (x / (n - 1) - 0.5) * 2,
        v = (y / (n - 1) - 0.5) * 2;
      const f = (a: number) => {
        const t = Math.min(Math.max((Math.abs(a) - 0.72) / 0.28, 0), 1);
        return 1 - t * t * (3 - 2 * t);
      };
      const k = Math.round(255 * f(u) * f(v));
      const i = (y * n + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = k;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/** Vertical gaussian fade for the outline belt, so it has no hard rim that bevel reflections could flash on. */
function beltTexture() {
  const h = 256,
    c = document.createElement("canvas");
  c.width = 4;
  c.height = h;
  const g = c.getContext("2d")!,
    img = g.createImageData(4, h);
  for (let y = 0; y < h; y++) {
    const v = (y / (h - 1) - 0.5) * 2;
    const k = Math.round(255 * Math.exp(-3.0 * v * v));
    for (let x = 0; x < 4; x++) {
      const i = (y * 4 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = k;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

type StripAnim = (t: number, p: number) => { x?: number; y?: number; k?: number };

interface StudioItem {
  name: string;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  hex: THREE.Color;
  base: number;
  home: THREE.Vector3;
  anim: StripAnim;
}

/** Light strips (Blender world -> three: x, z, -y). [colour, intensity, w, h, position, extra] */
function buildStudio(o: GlassXOptions) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x000000);
  const items: StudioItem[] = [];
  const soft = softTexture();

  const strip = (name: string, hex: number, w: number, h: number, x: number, y: number, z: number, base: number, anim: StripAnim) => {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex), map: soft, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    studio.add(mesh);
    items.push({ name, mesh, mat, hex: new THREE.Color(hex), base, home: mesh.position.clone(), anim });
  };

  // behind and around the sculpture (seen through / reflected by the glass)
  strip("violetTop", PALETTE.purple, 11, 0.3, 0, 4.2, -5.5, 14, (t, p) => ({ x: 3 * Math.sin(Math.PI * 2 * p), k: 0.8 + 0.2 * Math.cos(Math.PI * 2 * p) }));
  strip("violetLow", PALETTE.deepViolet, 10, 0.25, -1, -3.8, -6.5, 20, (t, p) => ({ x: -3 * Math.sin(Math.PI * 2 * p + 1), k: 0.75 + 0.25 * Math.sin(Math.PI * 2 * p) }));
  strip("blueRight", PALETTE.neonBlue, 0.25, 9, 6, 0.5, -1.5, 14, (t, p) => ({ y: 1.2 * Math.sin(Math.PI * 2 * p + 2), k: 0.8 + 0.2 * Math.sin(Math.PI * 2 * p + 0.5) }));
  strip("cyanLeft", PALETTE.cyanBlue, 0.2, 9, -6, 0, -1, 10, (t, p) => ({ y: -1.2 * Math.sin(Math.PI * 2 * p), k: 0.7 + 0.3 * Math.cos(Math.PI * 2 * p) }));
  // Back lights that follow the turn. While the X is turned, its thick side walls and bevels face sideways and
  // mirror what is BEHIND it, so a tall light placed behind and swept in step with the turn makes those walls
  // glow in sequence (violet first, a thin cyan-white edge just behind it) and fade out as the X faces front.
  const yawAt = (t: number) => THREE.MathUtils.degToRad(o.introYaw) * Math.pow(1 - Math.min(1, t / o.introSeconds), 3);
  const trackX = (t: number, dx: number) => Math.max(-14, Math.min(14, -6 * Math.tan(2 * yawAt(t)))) + dx;
  const bump = (t: number, c: number, w: number, hold: number) => hold + (1 - hold) * Math.exp(-Math.pow((t - c) / w, 2));
  strip("sweepViolet", 0x7a55ff, 4.5, 18, 0, 0, -6, 0.9, (t) => ({ x: trackX(t, 0), k: bump(t, 0.9, 0.85, 0.0) }));
  strip("sweepCyan", 0x8fdcff, 1.1, 18, 0, 0, -6, 0.9, (t) => ({ x: trackX(t, 1.5), k: bump(t, 0.9, 0.7, 0.0) }));
  strip("sweepBlue", PALETTE.neonBlue, 2.5, 18, 0, 0, -6, 0.7, (t) => ({ x: trackX(t, -2.4), k: bump(t, 1.1, 0.8, 0.0) }));

  // the cyan highlight that sweeps through once
  // in front (behind the camera): what the flat front faces mirror
  strip("faceViolet", PALETTE.purple, 1.2, 12, 1.0, 0, 12, 4.6, (t, p) => ({ x: 0.5 * Math.sin(Math.PI * 2 * p + 0.3), k: 1 }));
  strip("faceCyan", PALETTE.cyanBlue, 12, 0.825, 0, 0.45, 12, 3.4, (t, p) => ({ y: 0.4 * Math.sin(Math.PI * 2 * p + 1.7), k: 0.6 + 0.4 * Math.sin(Math.PI * 2 * p) }));

  // belt of light around the viewing axis: every bevelled edge mirrors it, so it draws the outline
  const beltMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.purple), map: beltTexture(), side: THREE.BackSide });
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 14, 96, 1, true), beltMat);
  belt.rotation.x = Math.PI / 2; // axis = Z (towards the camera)
  studio.add(belt);

  // second, wider belt in cyan-white: the iridescent edge flashes of the burst
  const beltCyanMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xa8e8ff), map: beltTexture(), side: THREE.BackSide });
  const beltCyan = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 9, 96, 1, true), beltCyanMat);
  beltCyan.rotation.x = Math.PI / 2;
  studio.add(beltCyan);

  // very dim violet dome: lets the glass body read as a faint ghost before and after the light burst
  const domeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.deepViolet), side: THREE.BackSide });
  studio.add(new THREE.Mesh(new THREE.SphereGeometry(40, 24, 16), domeMat));

  return {
    studio,
    items,
    beltMat,
    beltCyanMat,
    domeMat,
    beltColor: new THREE.Color(PALETTE.purple),
    beltCyanColor: new THREE.Color(0xa8e8ff),
    domeColor: new THREE.Color(PALETTE.deepViolet),
  };
}

export interface GlassXHandle {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  material: THREE.MeshPhysicalMaterial;
  options: GlassXOptions;
  applyLook: (t: number) => void;
  readonly bloomPass: UnrealBloomPass | null;
  readonly clampPass: ShaderPass | null;
  play(): void;
  pause(): void;
  restart(): void;
  setTime(t: number): void;
  dispose(): void;
}

export async function mountGlassX(container: HTMLElement, userOptions: Partial<GlassXOptions> = {}): Promise<GlassXHandle> {
  const o: GlassXOptions = { ...DEFAULTS, ...userOptions };
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const transparent = o.background == null;

  // ---- renderer / scene / camera ----------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: transparent, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.transmissionResolutionScale = 1.0;
  if (transparent) renderer.setClearColor(0x000000, 0);
  else renderer.setClearColor(new THREE.Color(o.background!), 1);
  renderer.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:none";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(o.fov, 1, 0.1, 100);
  camera.position.set(0, 0, o.distance);

  // ---- glass ------------------------------------------------------------------------------------
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: o.roughness,
    transmission: 1,
    thickness: 0.55,
    ior: 1.5,
    dispersion: o.dispersion,
    attenuationColor: new THREE.Color(0xd2a8ff),
    attenuationDistance: 1.4,
    specularIntensity: 1,
    envMapIntensity: 1,
    side: THREE.DoubleSide,
  });
  let gltf: GLTF;
  try {
    gltf = await new GLTFLoader().loadAsync(o.src);
  } catch (err) {
    // The caller falls back to the static image: leave no canvas or WebGL context behind.
    glass.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    throw err;
  }
  const rig = new THREE.Group(); // turned about the vertical axis during the reveal
  gltf.scene.traverse((n) => {
    const mesh = n as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.material = glass;
      mesh.geometry.computeBoundingSphere();
    }
  });
  rig.add(gltf.scene);
  scene.add(rig);

  // ---- light studio -> environment --------------------------------------------------------------
  const lights = buildStudio(o);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envTarget: THREE.WebGLRenderTarget | null = null;
  const rebuildEnv = () => {
    const next = pmrem.fromScene(lights.studio, 0, 0.1, 100);
    scene.environment = next.texture;
    if (envTarget) envTarget.dispose();
    envTarget = next;
  };

  /** Update the studio for time t (seconds) and rebuild the environment map. */
  const applyLook = (t: number) => {
    const p = Math.min(t / o.duration, 1);
    const fade = Math.pow(Math.min(1, t / 0.45), 2); // black at t = 0
    const burst = Math.exp(-Math.pow((p - 0.22) / 0.2, 2));
    for (const it of lights.items) {
      const a = it.anim(t, p);
      it.mesh.position.set(it.home.x + (a.x || 0), it.home.y + (a.y || 0), it.home.z);
      it.mesh.lookAt(0, 0, 0);
      const isFace = it.name.startsWith("face");
      const isGlint = it.name.startsWith("sweep");
      const lv = isGlint
        ? fade * o.peak * o.gain
        : isFace
          ? fade * o.faceHold * smooth(0.3, 0.9, p) * o.gain
          : fade * (o.ghost + (o.peak * o.stripPeak - o.ghost) * burst) * o.gain;
      it.mat.color.copy(it.hex).multiplyScalar(it.base * (a.k ?? 1) * lv);
    }
    const rimLevel = fade * (0.04 + 14 * smooth(0.5, 1.0, p) + o.edgeBurst * burst * 0.25) * o.rim; // outline: flashes in the burst, settles strong
    lights.beltMat.color.copy(lights.beltColor).multiplyScalar(rimLevel);
    lights.beltCyanMat.color.copy(lights.beltCyanColor).multiplyScalar(fade * burst * o.edgeBurst * 0.3 * o.rim);
    lights.domeMat.color.copy(lights.domeColor).multiplyScalar(fade * o.dome);
    rebuildEnv();
  };

  // ---- post: bloom (opaque background only) -----------------------------------------------------
  let composer: EffectComposer | null = null,
    bloom: UnrealBloomPass | null = null,
    clampPass: ShaderPass | null = null,
    despecklePass: ShaderPass | null = null;
  if (!transparent && o.bloom > 0) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    clampPass = new ShaderPass(HighlightClamp);
    clampPass.uniforms.maxV.value = o.highlightClamp;
    composer.addPass(clampPass);
    despecklePass = new ShaderPass(Despeckle);
    composer.addPass(despecklePass);
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.1, o.bloomRadius, o.bloomThreshold);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  const resize = () => {
    const w = container.clientWidth || 1,
      h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole X in frame for wide and for tall containers
    const d = camera.aspect >= 1 ? o.distance : o.distance / camera.aspect;
    camera.position.z = d;
    camera.updateProjectionMatrix();
    if (composer && despecklePass) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
      const pr = renderer.getPixelRatio();
      despecklePass.uniforms.px.value.set(1 / (w * pr), 1 / (h * pr));
    }
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  // ---- animation --------------------------------------------------------------------------------
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const onMove = (e: PointerEvent) => {
    pointer.x = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth - 0.5) * 2));
    pointer.y = Math.max(-1, Math.min(1, (e.clientY / window.innerHeight - 0.5) * 2));
  };
  if (o.pointer && !reduceMotion) window.addEventListener("pointermove", onMove, { passive: true });

  let time = reduceMotion ? o.duration : 0,
    playing = false,
    raf = 0,
    last = 0;

  const draw = () => {
    const t = time;
    const p = Math.min(t / o.duration, 1);
    rig.rotation.y = THREE.MathUtils.degToRad(o.introYaw) * Math.pow(1 - Math.min(1, t / o.introSeconds), 3);
    pointer.sx += (pointer.x - pointer.sx) * o.pointerSmooth;
    pointer.sy += (pointer.y - pointer.sy) * o.pointerSmooth;
    rig.rotation.y += pointer.sx * THREE.MathUtils.degToRad(o.pointerYaw);
    rig.rotation.x = pointer.sy * THREE.MathUtils.degToRad(o.pointerPitch);
    glass.roughness = o.roughness + (o.endRoughness - o.roughness) * smooth(0.4, 0.9, p);
    if (bloom) bloom.strength = (0.05 + o.glintBloom * Math.exp(-Math.pow((t - 1.2) / 0.9, 2)) + o.endBloom * smooth(0.45, 0.9, p)) * o.bloom;
    if (composer) composer.render();
    else renderer.render(scene, camera);
  };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (playing && time < o.duration) {
      time = Math.min(time + dt * o.speed, o.duration);
      applyLook(time); // environment only changes during the reveal
      if (time >= o.duration) playing = false;
    }
    draw();
  };

  let io: IntersectionObserver | null = null;
  const onClick = () => api.restart();

  const api: GlassXHandle = {
    renderer,
    scene,
    camera,
    material: glass,
    options: o,
    applyLook,
    get bloomPass() {
      return bloom;
    },
    get clampPass() {
      return clampPass;
    },
    play() {
      playing = true;
    },
    pause() {
      playing = false;
    },
    restart() {
      time = 0;
      playing = true;
      applyLook(0);
    },
    setTime(t) {
      time = Math.min(Math.max(t, 0), o.duration);
      playing = false;
      applyLook(time);
      draw();
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io?.disconnect();
      window.removeEventListener("pointermove", onMove);
      container.removeEventListener("click", onClick);
      envTarget?.dispose();
      pmrem.dispose();
      glass.dispose();
      gltf.scene.traverse((n) => (n as THREE.Mesh).geometry?.dispose());
      lights.studio.traverse((n) => {
        const mesh = n as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.map?.dispose();
        mat.dispose();
      });
      scene.environment = null;
      composer?.dispose();
      renderer.dispose();
      renderer.forceContextLoss(); // dispose() alone keeps the WebGL context alive until GC; browsers cap them at ~16
      renderer.domElement.remove();
    },
  };

  if (o.replayOnClick) container.addEventListener("click", onClick);

  applyLook(time);
  if (o.autoplay && !reduceMotion) {
    io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && time === 0) {
          api.restart();
          io?.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(container);
  }
  raf = requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
  return api;
}
