/**
 * Sprite renderer (runs in headless Chromium, driven by tools/render-sprites/run.mjs).
 *
 * Renders a character in the art bible's 3/4 view: fixed orthographic camera 40 degrees above
 * the horizon, one moon light fixed relative to the camera (so every direction is lit the
 * same), two-band toon ramp, silver rim, and an ink outline from alpha and depth edges.
 * Frames are packed into atlas pages; the page PNGs and a manifest go back to Node.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface ClipJob {
  /** Clip name in the manifest, e.g. 'idle'. */
  name: string;
  /** GLB URL (served by the dev server) carrying the model and this animation. */
  url?: string;
  /** Animation clip index or name inside the GLB; defaults to the first clip. */
  clip?: number | string;
  frames: number;
  /** Hold the last frame instead of looping (draw, death). */
  loop: boolean;
}
export interface SpriteJob {
  id: string;
  /** Output cell edge in px (2x in-game size). */
  cell: number;
  /** Character height in model units mapped to `heightPx` inside the cell. */
  modelHeight: number;
  heightPx: number;
  /** Feet anchor inside the cell (0..1). */
  pivot: [number, number];
  /** Unique directions to render; the left-facing three are mirrored in game. */
  directions: number[];
  ink: string;
  rim: string;
  clips: ClipJob[];
  /** Built-in mannequin instead of a GLB, for pipeline tests. */
  test?: boolean;
  page: number;
}

const PITCH = (40 * Math.PI) / 180;
const SUPERSAMPLE = 2;

/** Toon ramp, terminator at N.L = 0.35 with a cool shadow (art bible). */
function toonMaterial(source: THREE.Material, rim: THREE.Color): THREE.Material {
  const src = source as THREE.MeshStandardMaterial;
  const ramp = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 255, 255, 255, 255]), 2, 1);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  const m = new THREE.MeshToonMaterial({
    color: src.color ?? new THREE.Color(0xffffff),
    map: src.map ?? null,
    gradientMap: ramp,
    emissive: src.emissive ?? new THREE.Color(0),
    emissiveMap: src.emissiveMap ?? null,
    transparent: false,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: rim };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;')
      .replace(
        '#include <opaque_fragment>',
        `// Silver rim on the moon side (view-space up/right), 1-2 px wide after downsampling.
        float rimF = pow(1.0 - clamp(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 3.0);
        float moonSide = clamp(dot(normalize(vNormal.xy + 1e-4), normalize(vec2(0.6, 0.8))), 0.0, 1.0);
        outgoingLight += rimColor * step(0.45, rimF * moonSide) * 0.6;
        #include <opaque_fragment>`,
      );
  };
  return m;
}

/** Placeholder mannequin with a bob/stride animation, used to test the pipeline end to end. */
function mannequin(): { root: THREE.Object3D; clips: THREE.AnimationClip[] } {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = 'body';
  const mat = (c: number) => new THREE.MeshStandardMaterial({ color: c });
  const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.95, 24), mat(0x3a4560));
  cloak.position.y = 0.5;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 16), mat(0x2a3346));
  head.position.y = 1.15;
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 12), mat(0xe6ecf5));
  face.position.set(0, 1.12, 0.16);
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 32, Math.PI), mat(0xf4f7fb));
  bow.position.set(0, 0.75, 0.45);
  bow.rotation.set(0, Math.PI / 2, Math.PI / 2);
  const quiver = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.5, 12),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdbe8ff }),
  );
  quiver.position.set(0.2, 0.85, -0.3);
  quiver.rotation.z = 0.4;
  body.add(cloak, head, face, bow, quiver);
  root.add(body);
  const t = [0, 0.25, 0.5, 0.75, 1];
  const idle = new THREE.AnimationClip('idle', 1, [
    new THREE.NumberKeyframeTrack('body.position[y]', t, [0, 0.03, 0, 0.03, 0]),
  ]);
  const run = new THREE.AnimationClip('run', 0.6, [
    new THREE.NumberKeyframeTrack(
      'body.position[y]',
      [0, 0.15, 0.3, 0.45, 0.6],
      [0, 0.08, 0, 0.08, 0],
    ),
    new THREE.NumberKeyframeTrack('body.rotation[x]', [0, 0.3, 0.6], [0.15, 0.22, 0.15]),
  ]);
  return { root, clips: [idle, run] };
}

/** Ink outline from alpha and depth discontinuities, composited behind/over the colour. */
const OUTLINE = {
  vertex: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragment: `
    uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 texel; uniform vec3 ink; uniform float width;
    varying vec2 vUv;
    float depthAt(vec2 uv){ return texture2D(tDepth, uv).x; }
    void main(){
      vec4 c = texture2D(tColor, vUv);
      float a = c.a, maxA = 0.0, d = depthAt(vUv), edge = 0.0;
      for (int x = -3; x <= 3; x++) for (int y = -3; y <= 3; y++) {
        vec2 o = vec2(float(x), float(y));
        if (length(o) > width) continue;
        vec2 uv = vUv + o * texel;
        float na = texture2D(tColor, uv).a;
        maxA = max(maxA, na);
        if (a > 0.5 && na > 0.5 && abs(depthAt(uv) - d) > 0.004 && length(o) <= width * 0.5) edge = 1.0;
      }
      // Silhouette ink outside the shape, inner-line ink on depth breaks.
      vec3 rgb = mix(c.rgb, ink, edge);
      float outA = max(a, maxA);
      gl_FragColor = vec4(a > 0.5 ? rgb : ink, outA);
      #include <colorspace_fragment>
    }`,
};

async function load(url: string) {
  const gltf = await new GLTFLoader().loadAsync(url);
  return { root: gltf.scene, clips: gltf.animations };
}

export async function renderJob(job: SpriteJob) {
  const size = job.cell * SUPERSAMPLE;
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: false,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(size, size);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const target = new THREE.WebGLRenderTarget(size, size, {
    depthTexture: new THREE.DepthTexture(size, size),
    samples: 0,
  });
  target.texture.colorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  // Camera: orthographic, pitched 40 degrees down. Units per px from the height mapping.
  const unitsPerPx = job.modelHeight / (job.heightPx * SUPERSAMPLE);
  const half = (size / 2) * unitsPerPx;
  const camera = new THREE.OrthographicCamera(-half, half, half, -half, 0.01, 100);
  const dist = 20;
  camera.position.set(0, Math.sin(PITCH) * dist, Math.cos(PITCH) * dist);
  camera.lookAt(0, 0, 0);
  // Shift the frustum so the feet land on the pivot.
  const pivotOffsetX = (0.5 - job.pivot[0]) * size * unitsPerPx;
  const pivotOffsetY = (job.pivot[1] - 0.5) * size * unitsPerPx;
  camera.left += pivotOffsetX;
  camera.right += pivotOffsetX;
  camera.top += pivotOffsetY * Math.cos(PITCH);
  camera.bottom += pivotOffsetY * Math.cos(PITCH);
  camera.updateProjectionMatrix();

  // One light: the moon, high behind-left of camera, fixed in camera space.
  // Physical lights divide by PI: lit tone = (key + fill) x albedo ~= 1.1, shadow ~= 0.68 cool.
  scene.add(new THREE.AmbientLight(0xb8c4e8, 0.45 * Math.PI));
  const moon = new THREE.DirectionalLight(0xeef2ff, 0.65 * Math.PI);
  moon.position.set(-4, 9, 6);
  scene.add(moon);

  const rim = new THREE.Color(job.rim);
  const loaded = new Map<string, { root: THREE.Object3D; clips: THREE.AnimationClip[] }>();
  const sourceFor = async (url?: string) => {
    const key = job.test ? 'test' : url!;
    if (!loaded.has(key)) {
      const src = job.test ? mannequin() : await load(url!);
      src.root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh)
          mesh.material = Array.isArray(mesh.material)
            ? mesh.material.map((m) => toonMaterial(m, rim))
            : toonMaterial(mesh.material, rim);
      });
      // Normalise: feet on y=0, centred, scaled to modelHeight.
      const box = new THREE.Box3().setFromObject(src.root);
      const h = box.max.y - box.min.y || 1;
      const k = job.modelHeight / h;
      src.root.scale.setScalar(k);
      const c = box.getCenter(new THREE.Vector3());
      src.root.position.set(-c.x * k, -box.min.y * k, -c.z * k);
      loaded.set(key, src);
    }
    return loaded.get(key)!;
  };

  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: OUTLINE.vertex,
      fragmentShader: OUTLINE.fragment,
      uniforms: {
        tColor: { value: target.texture },
        tDepth: { value: target.depthTexture },
        texel: { value: new THREE.Vector2(1 / size, 1 / size) },
        ink: { value: new THREE.Color(job.ink) },
        width: { value: 2 * SUPERSAMPLE },
      },
      transparent: true,
    }),
  );
  const post = new THREE.Scene();
  post.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // Downsample canvas (supersample -> cell) and atlas pages.
  const cellCanvas = document.createElement('canvas');
  cellCanvas.width = cellCanvas.height = job.cell;
  const cellCtx = cellCanvas.getContext('2d')!;
  cellCtx.imageSmoothingQuality = 'high';
  const perRow = Math.floor(job.page / job.cell);
  const perPage = perRow * perRow;
  const pages: HTMLCanvasElement[] = [];
  const frames: Record<string, { page: number; x: number; y: number }[][]> = {};
  let index = 0;
  const place = () => {
    const pageIndex = Math.floor(index / perPage),
      slot = index % perPage;
    if (!pages[pageIndex]) {
      const p = document.createElement('canvas');
      p.width = p.height = job.page;
      pages[pageIndex] = p;
    }
    index++;
    return {
      page: pageIndex,
      x: (slot % perRow) * job.cell,
      y: Math.floor(slot / perRow) * job.cell,
    };
  };

  for (const clipJob of job.clips) {
    const src = await sourceFor(clipJob.url);
    scene.add(src.root);
    const mixer = new THREE.AnimationMixer(src.root);
    const clip =
      typeof clipJob.clip === 'string'
        ? (src.clips.find((c) => c.name === clipJob.clip) ?? src.clips[0])
        : (src.clips[clipJob.clip ?? 0] ?? src.clips[0]);
    const action = clip ? mixer.clipAction(clip) : null;
    action?.play();
    frames[clipJob.name] = [];
    for (const dir of job.directions) {
      const row: { page: number; x: number; y: number }[] = [];
      // Direction 0 faces screen-right; directions step 45 degrees clockwise on screen.
      src.root.rotation.y = Math.PI / 2 - (dir * Math.PI) / 4;
      for (let f = 0; f < clipJob.frames; f++) {
        const duration = clip?.duration ?? 1;
        const t = clipJob.loop
          ? (f / clipJob.frames) * duration
          : (f / Math.max(1, clipJob.frames - 1)) * duration;
        mixer.setTime(t);
        renderer.setRenderTarget(target);
        renderer.clear();
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        renderer.clear();
        renderer.render(post, postCam);
        cellCtx.clearRect(0, 0, job.cell, job.cell);
        cellCtx.drawImage(renderer.domElement, 0, 0, size, size, 0, 0, job.cell, job.cell);
        const at = place();
        pages[at.page].getContext('2d')!.drawImage(cellCanvas, at.x, at.y);
        row.push(at);
      }
      frames[clipJob.name].push(row);
    }
    scene.remove(src.root);
  }
  renderer.dispose();
  return {
    manifest: {
      id: job.id,
      cell: job.cell,
      pivot: job.pivot,
      directions: job.directions,
      fps: 12,
      clips: Object.fromEntries(
        job.clips.map((c) => [c.name, { frames: c.frames, loop: c.loop, cells: frames[c.name] }]),
      ),
      pages: pages.length,
    },
    pages: pages.map((p) => p.toDataURL('image/png')),
  };
}

(window as unknown as { renderJob: typeof renderJob }).renderJob = renderJob;
