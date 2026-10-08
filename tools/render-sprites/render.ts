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
import { PROCEDURAL, rigid, type Legs } from './procedural';

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
  /** Clip window in seconds; defaults to the whole clip. */
  start?: number;
  end?: number;
  /** Extra yaw (degrees) so a side-on pose aims its bow, not its chest, at the direction. */
  yaw?: number;
  /** Strip horizontal root motion (rolls, lunges) so the figure stays on its pivot. */
  inPlace?: boolean;
  /** Playback fps for this clip in game (default: the sheet's 12). */
  fps?: number;
  /** Pull the bowstring to the drawing hand. */
  drawing?: boolean;
  /** Hide the eye glints (tumbling clips such as rolls and hit reactions). */
  noEyes?: boolean;
}
/** A procedural bow held in one hand; its string follows the other hand while drawing. */
export interface BowJob {
  hand: string;
  stringHand: string;
  /** Half the bow's length, in character heights. */
  size: number;
  wood: string;
  trim: string;
  arrow: string;
}
/** Emissive eyes placed relative to the head bone (character heights). */
export interface EyesJob {
  bone: string;
  forward: number;
  up: number;
  spread: number;
  radius: number;
  color: string;
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
  /** Code-built character (render-sprites/procedural.ts) instead of a GLB. */
  procedural?: string;
  /** Unrigged model driven by renderer-side motion (procedural.ts RIGID). */
  rigid?: string;
  /** Leg columns for a procedural gallop on an unrigged quadruped (procedural.ts legRig). */
  legs?: Legs;
  /** Antler crown on the head bone (boss weak point), in the given colour. */
  crown?: { color: string; size: number };
  bow?: BowJob;
  eyes?: EyesJob;
  /** Albedo multiplier (elite variants render brighter). */
  brightness?: number;
  /** Keep pale painted accents (crowns, glowing eyes) flat, bright and uncorrected. */
  glow?: boolean;
  /** Per-channel colour correction toward the palette (linear RGB multipliers). */
  albedo?: [number, number, number];
  page: number;
}

const PITCH = (40 * Math.PI) / 180;
const SUPERSAMPLE = 2;

/** Toon ramp, terminator at N.L = 0.35 with a cool shadow (art bible). */
function toonMaterial(
  source: THREE.Material,
  rim: THREE.Color,
  brightness = 1,
  albedo: [number, number, number] = [1, 1, 1],
  glow = false,
): THREE.Material {
  const src = source as THREE.MeshStandardMaterial;
  const ramp = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 255, 255, 255, 255]), 2, 1);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  const m = new THREE.MeshToonMaterial({
    color: (src.color ?? new THREE.Color(0xffffff))
      .clone()
      .multiply(new THREE.Color(albedo[0], albedo[1], albedo[2]))
      .multiplyScalar(brightness),
    map: src.map ?? null,
    gradientMap: ramp,
    emissive: src.emissive ?? new THREE.Color(0),
    emissiveMap: src.emissiveMap ?? null,
    transparent: false,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: rim };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 rimColor;\nfloat glowMask = 0.0;',
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        #if defined(USE_MAP) && ${glow ? 1 : 0}
        // Pale painted accents (a gold crown, glowing eyes) stay flat and bright: they are
        // emissive in the art bible, so neither the albedo correction nor shading touches them.
        glowMask = smoothstep(0.3, 0.42, sampledDiffuseColor.g) * smoothstep(0.14, 0.22, sampledDiffuseColor.b);
        #endif`,
      )
      .replace(
        '#include <opaque_fragment>',
        `// Silver rim on the moon side (view-space up/right), 1-2 px wide after downsampling.
        float rimF = pow(1.0 - clamp(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 3.0);
        float moonSide = clamp(dot(normalize(vNormal.xy + 1e-4), normalize(vec2(0.6, 0.8))), 0.0, 1.0);
        outgoingLight += rimColor * step(0.45, rimF * moonSide) * 0.6;
        #ifdef USE_MAP
        outgoingLight = mix(outgoingLight, sampledDiffuseColor.rgb * 1.1, glowMask);
        #endif
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

const v3 = () => new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
/** Builds the bow, string, nocked arrow and eye glints; update() poses them from the skeleton. */
function makeProps(job: SpriteJob, root: THREE.Object3D, rim: THREE.Color) {
  const group = new THREE.Group();
  const height = job.modelHeight;
  const bone = (name: string) => {
    const b = root.getObjectByName(name);
    if (!b) throw new Error('missing bone ' + name);
    return b;
  };
  const wood = toonMaterial(
    new THREE.MeshStandardMaterial({ color: job.bow?.wood ?? '#2b3142' }),
    rim,
  );
  const trim = new THREE.MeshBasicMaterial({ color: job.bow?.trim ?? '#e6ecf5' });
  const glow = new THREE.MeshBasicMaterial({ color: job.bow?.arrow ?? '#ffffff' });
  const limb = new THREE.Mesh(new THREE.BufferGeometry(), wood);
  const string = new THREE.Mesh(new THREE.BufferGeometry(), trim);
  const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6), glow);
  // Stylised: the eyes glow through the hood brim whenever the face is turned toward camera.
  const eyeMat = new THREE.MeshBasicMaterial({
    color: job.eyes?.color ?? '#ffffff',
    depthTest: false,
  });
  const eyes = [0, 1].map(() => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), eyeMat);
    m.renderOrder = 10;
    return m;
  });
  if (job.bow) group.add(limb, string, arrow);
  // Antler crown: tines fanning up and out from the head (weak point glow is flat, unlit).
  const crownMat = new THREE.MeshBasicMaterial({ color: job.crown?.color ?? '#ffe7a8' });
  const tines = job.crown
    ? Array.from({ length: 7 }, (_, i) => {
        const m = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 6), crownMat);
        m.userData.i = i;
        group.add(m);
        return m;
      })
    : [];
  if (job.eyes) group.add(...eyes);
  const tube = (points: THREE.Vector3[], radius: number) =>
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, radius, 6, false);
  return {
    group,
    update(drawing: boolean, camera: THREE.Camera, showEyes = true) {
      root.updateMatrixWorld(true);
      if (job.bow) {
        const b = job.bow,
          grip = bone(b.hand).getWorldPosition(v3()),
          elbow = bone(b.hand).parent!.getWorldPosition(v3()),
          pull = bone(b.stringHand).getWorldPosition(v3());
        // Aim: along the forearm. The bow stands perpendicular to it, upright when it can be.
        const aim = v3().subVectors(grip, elbow).normalize();
        let up = v3().copy(UP).addScaledVector(aim, -UP.dot(aim));
        if (up.lengthSq() < 0.05) up = v3().crossVectors(aim, new THREE.Vector3(1, 0, 0));
        up.normalize();
        const h = b.size * height,
          belly = aim.clone().multiplyScalar(h * 0.18),
          back = aim.clone().multiplyScalar(-h * 0.22);
        const tipA = grip.clone().addScaledVector(up, h).add(back),
          tipB = grip.clone().addScaledVector(up, -h).add(back);
        limb.geometry.dispose();
        limb.geometry = tube(
          [
            tipA,
            grip
              .clone()
              .addScaledVector(up, h * 0.55)
              .add(belly.clone().multiplyScalar(0.6)),
            grip.clone().add(belly),
            grip
              .clone()
              .addScaledVector(up, -h * 0.55)
              .add(belly.clone().multiplyScalar(0.6)),
            tipB,
          ],
          height * 0.02,
        );
        // The string runs tip-to-tip, or through the drawing hand when it is behind the grip.
        const behind = v3().subVectors(pull, grip).dot(aim) < -height * 0.05;
        const nock = drawing && behind ? pull : grip.clone().add(back);
        string.geometry.dispose();
        string.geometry = new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3([tipA, nock, tipB], false, 'chordal', 0),
          16,
          height * 0.004,
          4,
          false,
        );
        arrow.visible = drawing && behind;
        if (arrow.visible) {
          const tip = grip.clone().addScaledVector(aim, h * 0.55),
            mid = v3().addVectors(nock, tip).multiplyScalar(0.5);
          arrow.position.copy(mid);
          arrow.scale.set(1, nock.distanceTo(tip), 1);
          arrow.quaternion.setFromUnitVectors(UP, v3().subVectors(tip, nock).normalize());
        }
      }
      if (job.crown) {
        const head = bone('Head').getWorldPosition(v3()),
          face = bone('headfront').getWorldPosition(v3()),
          fwd = v3().subVectors(face, head).setY(0).normalize(),
          side = v3().crossVectors(UP, fwd).normalize(),
          size = job.crown.size * height,
          top = head.clone().addScaledVector(UP, size * 1.1);
        for (const m of tines) {
          const i = m.userData.i as number,
            a = ((i - 3) / 3) * 1.1,
            len = size * (i % 2 ? 0.8 : 1.15);
          const dir = v3()
            .copy(UP)
            .multiplyScalar(Math.cos(a))
            .addScaledVector(side, Math.sin(a))
            .addScaledVector(fwd, -0.15)
            .normalize();
          m.position.copy(top).addScaledVector(dir, len * 0.5);
          m.scale.set(size * 0.12, len, size * 0.12);
          m.quaternion.setFromUnitVectors(UP, dir);
        }
      }
      if (job.eyes) {
        const e = job.eyes,
          // Face frame from head -> face-front bones (head bone axes vary between rigs).
          head = bone('Head').getWorldPosition(v3()),
          pos = bone(e.bone).getWorldPosition(v3()),
          fwd = v3().subVectors(pos, head).setY(0).normalize(),
          side = v3().crossVectors(UP, fwd).normalize(),
          upv = UP,
          toCamera = camera.getWorldDirection(v3()).negate(),
          facing = fwd.dot(toCamera);
        eyes.forEach((m, i) => {
          m.visible = showEyes && facing > 0.25;
          m.position
            .copy(pos)
            .addScaledVector(fwd, e.forward * height)
            .addScaledVector(upv, e.up * height)
            .addScaledVector(side, (i ? 1 : -1) * e.spread * height);
          m.scale.setScalar(e.radius * height);
        });
      }
    },
  };
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
  const loaded = new Map<
    string,
    {
      root: THREE.Object3D;
      clips: THREE.AnimationClip[];
      pose?: (clip: string, t: number) => void;
    }
  >();
  const sourceFor = async (url?: string) => {
    const key = job.procedural ?? (job.test ? 'test' : url!);
    if (!loaded.has(key)) {
      const src = job.procedural
        ? PROCEDURAL[job.procedural]()
        : job.test
          ? mannequin()
          : await load(url!);
      src.root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh)
          mesh.material = Array.isArray(mesh.material)
            ? mesh.material.map((m) => toonMaterial(m, rim, job.brightness, job.albedo, job.glow))
            : toonMaterial(mesh.material, rim, job.brightness, job.albedo, job.glow);
      });
      // Normalise: feet on y=0, centred, scaled to modelHeight.
      const box = new THREE.Box3().setFromObject(src.root);
      const h = box.max.y - box.min.y || 1;
      const k = job.modelHeight / h;
      src.root.scale.setScalar(k);
      const c = box.getCenter(new THREE.Vector3());
      src.root.position.set(-c.x * k, -box.min.y * k, -c.z * k);
      loaded.set(key, job.rigid ? rigid(src, job.rigid, job.modelHeight, job.legs) : src);
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
    // One-shot clips must not wrap: sampling exactly at the end would show frame 0.
    if (action && !clipJob.loop) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    action?.play();
    const props = job.bow || job.eyes || job.crown ? makeProps(job, src.root, rim) : null;
    if (props) scene.add(props.group);
    // Root motion: the hips' horizontal offset at the window start is held for the whole clip.
    const hips = clipJob.inPlace ? src.root.getObjectByName('Hips') : null;
    const start = clipJob.start ?? 0,
      end = clipJob.end ?? (clip ? clip.duration - 1e-3 : 1);
    mixer.setTime(start);
    const hipRest = hips ? hips.position.clone() : null;
    frames[clipJob.name] = [];
    for (const dir of job.directions) {
      // A one-shot clip that reached its end is paused by three.js; restart it per direction.
      if (action) {
        action.reset();
        action.play();
      }
      const row: { page: number; x: number; y: number }[] = [];
      // Direction 0 faces screen-right; directions step 45 degrees clockwise on screen.
      src.root.rotation.y =
        Math.PI / 2 - (dir * Math.PI) / 4 + ((clipJob.yaw ?? 0) * Math.PI) / 180;
      for (let f = 0; f < clipJob.frames; f++) {
        const span = end - start;
        const t =
          start +
          (clipJob.loop
            ? (f / clipJob.frames) * span
            : (f / Math.max(1, clipJob.frames - 1)) * span);
        mixer.setTime(t);
        src.pose?.(clipJob.name, t);
        if (hips && hipRest) {
          hips.position.x = hipRest.x;
          hips.position.z = hipRest.z;
        }
        props?.update(!!clipJob.drawing, camera, !clipJob.noEyes);
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
    if (props) scene.remove(props.group);
  }
  renderer.dispose();
  return {
    manifest: {
      id: job.id,
      cell: job.cell,
      heightPx: job.heightPx,
      pivot: job.pivot,
      directions: job.directions,
      fps: 12,
      clips: Object.fromEntries(
        job.clips.map((c) => [
          c.name,
          { frames: c.frames, loop: c.loop, fps: c.fps, cells: frames[c.name] },
        ]),
      ),
      pages: pages.length,
    },
    pages: pages.map((p) => p.toDataURL('image/png')),
  };
}

(window as unknown as { renderJob: typeof renderJob }).renderJob = renderJob;
