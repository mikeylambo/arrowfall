/**
 * Code-built characters for the sprite renderer. They go through the same toon ramp, rim and
 * ink outline as Meshy models, so they sit in the same style. Facing is +Z, up is +Y.
 */
import * as THREE from 'three';

const mat = (color: string, emissive = '#000000') =>
  new THREE.MeshStandardMaterial({ color, emissive });

/** Sample `f(t)` at n steps over `duration` into a vector3 position track. */
function positionTrack(name: string, duration: number, n: number, f: (t: number) => number[]) {
  const times: number[] = [],
    values: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * duration;
    times.push(t);
    values.push(...f(t));
  }
  return new THREE.VectorKeyframeTrack(`${name}.position`, times, values);
}
function scaleTrack(name: string, duration: number, n: number, f: (t: number) => number[]) {
  const times: number[] = [],
    values: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * duration;
    times.push(t);
    values.push(...f(t));
  }
  return new THREE.VectorKeyframeTrack(`${name}.scale`, times, values);
}
function rotationTrack(name: string, duration: number, n: number, f: (t: number) => number[]) {
  const times: number[] = [],
    values: number[] = [];
  const e = new THREE.Euler(),
    q = new THREE.Quaternion();
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * duration;
    times.push(t);
    const [x, y, z] = f(t);
    q.setFromEuler(e.set(x, y, z));
    values.push(q.x, q.y, q.z, q.w);
  }
  return new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values);
}

/** Wisp: an upright flame with a hollow bright core, licking tongues and a hovering bob. */
export function wisp(): { root: THREE.Object3D; clips: THREE.AnimationClip[] } {
  const root = new THREE.Group(),
    body = new THREE.Group();
  body.name = 'body';
  // Flame body: round base, tapering to a point, leaning back from its direction of travel.
  const profile = [
    [0, 0],
    [0.14, 0.04],
    [0.22, 0.16],
    [0.21, 0.3],
    [0.15, 0.44],
    [0.08, 0.58],
    [0.02, 0.72],
    [0, 0.76],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const flame = new THREE.Mesh(new THREE.LatheGeometry(profile, 24), mat('#c23a4a'));
  flame.rotation.x = -0.25;
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), mat('#ffd9dc', '#ff9aa8'));
  core.position.set(0, 0.2, 0.06);
  const eyes = [-1, 1].map((s) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat('#ffffff', '#ffffff'));
    e.position.set(s * 0.07, 0.3, 0.2);
    return e;
  });
  body.add(flame, core, ...eyes);
  const tongues: THREE.Object3D[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const pivot = new THREE.Group();
    pivot.name = 'tongue' + i;
    pivot.position.set(Math.cos(a) * 0.17, 0.26, Math.sin(a) * 0.17 - 0.05);
    const t = new THREE.Mesh(
      new THREE.ConeGeometry(0.075, 0.46, 10),
      mat(i % 2 ? '#a8303f' : '#e05565'),
    );
    t.position.y = 0.23;
    pivot.add(t);
    body.add(pivot);
    tongues.push(pivot);
  }
  root.add(body);
  const d = 1.2,
    n = 12,
    w = (t: number) => (t / d) * Math.PI * 2;
  const move = new THREE.AnimationClip('move', d, [
    positionTrack('body', d, n, (t) => [0, 0.08 + Math.sin(w(t)) * 0.05, 0]),
    scaleTrack('body', d, n, (t) => {
      const s = 1 + Math.sin(w(t) * 2) * 0.06;
      return [1 / s, s, 1 / s];
    }),
    ...tongues.map((_, i) =>
      rotationTrack('tongue' + i, d, n, (t) => {
        const a = (i / 5) * Math.PI * 2,
          lean = 0.75 + Math.sin(w(t) * 2 + i * 1.3) * 0.3;
        return [-Math.sin(a) * lean - 0.25, 0, Math.cos(a) * lean];
      }),
    ),
  ]);
  return { root, clips: [move] };
}

/** Barrow Worm: a segmented arc that undulates as it travels and rears up to erupt. */
export function worm(): { root: THREE.Object3D; clips: THREE.AnimationClip[] } {
  const root = new THREE.Group();
  const d = 1.0,
    n = 12;
  const crawl = (i: number, t: number) => {
    const ph = (t / d) * Math.PI * 2 - i * 0.9;
    return [Math.sin(ph) * 0.07, 0.13 + Math.max(0, Math.sin(ph)) * 0.08, -i * 0.2 + 0.6];
  };
  const N = 7,
    segments: THREE.Object3D[] = [];
  for (let i = 0; i < N; i++) {
    const r = 0.16 - i * 0.013;
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(r, 18, 12),
      mat(i % 2 ? '#7a1c26' : '#b0303a'),
    );
    s.scale.set(1.1, 0.85, 1);
    s.name = 'seg' + i;
    root.add(s);
    segments.push(s);
  }
  // Head: jaws and eyes on the first segment.
  const head = segments[0];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const fang = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 8), mat('#ffd9dc'));
    fang.position.set(Math.cos(a) * 0.09, Math.sin(a) * 0.08, 0.15);
    fang.rotation.x = Math.PI / 2;
    head.add(fang);
  }
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mat('#ffffff', '#ff9aa8'));
    e.position.set(s * 0.08, 0.08, 0.1);
    head.add(e);
  }
  // Rest pose = first crawl frame, so the renderer's size normalisation sees the real body.
  segments.forEach((s, i) => s.position.fromArray(crawl(i, 0)));
  const move = new THREE.AnimationClip(
    'move',
    d,
    segments.map((_, i) => positionTrack('seg' + i, d, n, (t) => crawl(i, t))),
  );
  // Erupt: the front of the body rears straight up out of the ground.
  const e = 0.8;
  const attack = new THREE.AnimationClip(
    'attack',
    e,
    segments.map((_, i) =>
      positionTrack('seg' + i, e, n, (t) => {
        const k = Math.min(1, t / (e * 0.7)),
          from = crawl(i, 0),
          up = i < 4 ? [0, 0.15 + (4 - i) * 0.2, 0.1 + i * 0.02] : [0, 0.13, 0.1 - (i - 3) * 0.2];
        return from.map((v, j) => v + (up[j] - v) * k * k * (3 - 2 * k));
      }),
    ),
  );
  return { root, clips: [move, attack] };
}

export const PROCEDURAL: Record<
  string,
  () => { root: THREE.Object3D; clips: THREE.AnimationClip[] }
> = { wisp, worm };

/**
 * Motion for unrigged models (Meshy model-only): the whole mesh sits in a `body` group whose
 * origin is at the feet, and these clips bob, pitch and squash it. Cheap, and at sprite size a
 * gallop read comes almost entirely from the bounce and lean. Pitch is about X; +x leans forward.
 */
type Motion = {
  root: THREE.Object3D;
  clips: THREE.AnimationClip[];
  /** Per-frame pose hook for deformation the clips cannot express (clip name, clip time). */
  pose?: (clip: string, t: number) => void;
};
/**
 * Leg columns of an unrigged quadruped, in the model's own geometry units: the hip line as a
 * fraction of height, where the swing fades in below it, and the z span and hip z of each pair.
 * `split` is the x that divides left legs from right.
 */
export interface Legs {
  hip: number;
  fade: number;
  split: number;
  front: [number, number, number];
  back: [number, number, number];
  amp: number;
  /** 'gallop' (hound: fore and hind pairs) or 'trot' (stag: diagonal pairs, rears to charge). */
  gait?: 'gallop' | 'trot';
  /** Stride length of the move clip and length of the attack clip, in seconds. */
  cycle?: number;
  attack?: number;
}
const smooth = (k: number) => k * k * (3 - 2 * k);
function rigidClip(
  name: string,
  d: number,
  n: number,
  f: (t: number) => { y?: number; z?: number; pitch?: number; roll?: number; sq?: number },
) {
  return new THREE.AnimationClip(name, d, [
    positionTrack('body', d, n, (t) => {
      const m = f(t);
      return [0, m.y ?? 0, m.z ?? 0];
    }),
    rotationTrack('body', d, n, (t) => {
      const m = f(t);
      return [m.pitch ?? 0, 0, m.roll ?? 0];
    }),
    scaleTrack('body', d, n, (t) => {
      const s = 1 + (f(t).sq ?? 0);
      return [1 / Math.sqrt(s), s, 1 / Math.sqrt(s)];
    }),
  ]);
}

export const RIGID: Record<string, (h: number) => THREE.AnimationClip[]> = {
  /** Moonhound: fast bounding gallop; the lunge crouches low, then springs forward stretched. */
  hound: (h) => [
    rigidClip('move', 0.5, 12, (t) => {
      const w = (t / 0.5) * Math.PI * 2;
      return {
        y: Math.max(0, Math.sin(w)) * 0.09 * h,
        pitch: Math.cos(w) * 0.13,
        sq: Math.sin(w) * 0.07,
      };
    }),
    rigidClip('attack', 0.6, 12, (t) => {
      const k = t / 0.6;
      const crouch = smooth(Math.min(1, k / 0.75)),
        spring = smooth(Math.max(0, (k - 0.75) / 0.25));
      return {
        y: spring * 0.12 * h,
        z: spring * 0.25 * h,
        pitch: -0.12 * crouch * (1 - spring) + 0.22 * spring,
        sq: -0.22 * crouch * (1 - spring) + 0.12 * spring,
      };
    }),
  ],
  /** Hollow Stag: heavy trot; the charge rears back, then drops its antlers forward. */
  stag: (h) => [
    rigidClip('move', 0.8, 12, (t) => {
      const w = (t / 0.8) * Math.PI * 2;
      return {
        y: Math.abs(Math.sin(w)) * 0.035 * h,
        pitch: Math.sin(w) * 0.05,
        roll: Math.sin(w) * 0.03,
        sq: -Math.abs(Math.cos(w)) * 0.03,
      };
    }),
    rigidClip('attack', 0.9, 12, (t) => {
      const k = t / 0.9;
      const rear = Math.sin(Math.min(1, k / 0.7) * Math.PI),
        drop = smooth(Math.max(0, (k - 0.55) / 0.45));
      return {
        y: rear * 0.08 * h,
        z: drop * 0.06 * h,
        pitch: -0.32 * rear + 0.28 * drop,
        sq: 0.05 * rear - 0.08 * drop,
      };
    }),
  ],
  /** Bramble King: rooted lumbering sway; its attack rears up tall, then slams down squat. */
  bramble: (h) => [
    rigidClip('move', 1.4, 12, (t) => {
      const w = (t / 1.4) * Math.PI * 2;
      return {
        y: Math.abs(Math.sin(w)) * 0.02 * h,
        roll: Math.sin(w) * 0.07,
        sq: Math.cos(w * 2) * 0.03,
      };
    }),
    rigidClip('attack', 1.0, 12, (t) => {
      const k = t / 1.0;
      const rise = smooth(Math.min(1, k / 0.7)),
        slam = smooth(Math.max(0, (k - 0.7) / 0.3));
      return {
        y: rise * (1 - slam) * 0.06 * h,
        pitch: -0.12 * rise * (1 - slam) + 0.12 * slam,
        sq: 0.1 * rise * (1 - slam) - 0.14 * slam,
      };
    }),
  ],
  /** Night Hag: floats clear of the ground, bobbing and swaying; casting lifts her and flings forward. */
  hag: (h) => [
    rigidClip('move', 1.6, 12, (t) => {
      const w = (t / 1.6) * Math.PI * 2;
      return {
        y: (0.14 + Math.sin(w) * 0.04) * h,
        pitch: -0.12 + Math.sin(w + 1) * 0.04,
        roll: Math.sin(w * 0.5 * 2) * 0.05,
        sq: Math.sin(w) * 0.03,
      };
    }),
    rigidClip('attack', 0.6, 8, (t) => {
      const k = t / 0.6;
      const lift = Math.sin(Math.min(1, k / 0.8) * Math.PI * 0.5),
        fling = smooth(Math.max(0, (k - 0.55) / 0.45));
      return {
        y: (0.14 + 0.08 * lift - 0.04 * fling) * h,
        pitch: -0.12 - 0.2 * lift * (1 - fling) + 0.22 * fling,
        sq: 0.08 * lift * (1 - fling) - 0.04 * fling,
      };
    }),
  ],
};

/** Wrap a loaded static model so RIGID clips can drive it. */
export function rigid(src: Motion, motion: string, height: number, legs?: Legs): Motion {
  const root = new THREE.Group(),
    body = new THREE.Group();
  body.name = 'body';
  body.add(src.root);
  root.add(body);
  return { root, clips: RIGID[motion](height), pose: legs ? legRig(src.root, legs) : undefined };
}

/**
 * Procedural leg swing for a static mesh: each vertex in a leg column rotates about its pair's
 * hip line (an x axis), blended in below the hip so the shoulder flexes rather than tears, and
 * blended left to right across `split` so the chest never shears. Positions and normals are
 * rewritten from a rest copy every frame.
 */
function legRig(model: THREE.Object3D, legs: Legs) {
  const meshes: {
    position: THREE.BufferAttribute;
    normal: THREE.BufferAttribute | null;
    rest: Float32Array;
    restN: Float32Array | null;
    pair: Int8Array;
    side: Float32Array;
    weight: Float32Array;
  }[] = [];
  // Bounds in raw geometry units (the model root is already scaled, the geometry is not).
  const box = new THREE.Box3();
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.computeBoundingBox();
    box.union(mesh.geometry.boundingBox!);
  });
  const y0 = box.min.y,
    H = box.max.y - box.min.y;
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    const g = mesh.geometry,
      position = g.getAttribute('position') as THREE.BufferAttribute,
      normal = (g.getAttribute('normal') as THREE.BufferAttribute) ?? null,
      n = position.count,
      pair = new Int8Array(n),
      side = new Float32Array(n),
      weight = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = position.getX(i),
        y = (position.getY(i) - y0) / H,
        z = position.getZ(i);
      const p =
        z >= legs.front[0] && z <= legs.front[1]
          ? 1
          : z >= legs.back[0] && z <= legs.back[1]
            ? 2
            : 0;
      if (!p || y > legs.hip) continue;
      pair[i] = p;
      weight[i] = Math.min(1, (legs.hip - y) / legs.fade);
      side[i] = Math.min(1, Math.max(0, (x - legs.split + 0.06) / 0.12));
    }
    meshes.push({
      position,
      normal,
      rest: new Float32Array(position.array as Float32Array),
      restN: normal ? new Float32Array(normal.array as Float32Array) : null,
      pair,
      side,
      weight,
    });
  });
  const hipY = y0 + legs.hip * H;
  /** Swing angles (radians, + = foot forward) for [front-left, front-right, back-left, back-right]. */
  const angles = (clip: string, t: number): number[] => {
    const a = legs.amp,
      trot = legs.gait === 'trot';
    if (clip === 'attack') {
      const k = t / (legs.attack ?? 0.6);
      if (trot) {
        // Rear: forelegs lift and paw forward; then they plant back for the charge.
        const rear = Math.sin(Math.min(1, k / 0.7) * Math.PI),
          drop = Math.max(0, (k - 0.55) / 0.45);
        const f = 1.3 * a * rear - 0.4 * a * drop,
          b = -0.35 * a * rear + 0.3 * a * drop;
        return [f, f * 0.85, b, b * 0.9];
      }
      // Crouch: feet gather under the body; spring: front reach forward, hind kick back.
      const crouch = Math.min(1, k / 0.75),
        spring = Math.max(0, (k - 0.75) / 0.25);
      const f = -0.25 * crouch * (1 - spring) + 1.1 * a * spring,
        b = 0.25 * crouch * (1 - spring) - 1.1 * a * spring;
      return [f, f * 0.9, b, b * 0.9];
    }
    const w = (t / (legs.cycle ?? 0.5)) * Math.PI * 2;
    if (trot)
      // Trot: diagonal pairs (front-left with back-right) swing together.
      return [
        a * Math.sin(w),
        a * Math.sin(w + Math.PI),
        a * Math.sin(w + Math.PI),
        a * Math.sin(w),
      ];
    // Rotary gallop: fore pair and hind pair half a stride apart, each pair slightly staggered.
    return [
      a * Math.sin(w),
      a * Math.sin(w + 0.45),
      a * Math.sin(w + Math.PI),
      a * Math.sin(w + Math.PI + 0.45),
    ];
  };
  return (clip: string, t: number) => {
    const [fl, fr, bl, br] = angles(clip, t);
    for (const m of meshes) {
      const out = m.position.array as Float32Array,
        outN = m.normal ? (m.normal.array as Float32Array) : null;
      out.set(m.rest);
      if (outN && m.restN) outN.set(m.restN);
      for (let i = 0; i < m.pair.length; i++) {
        const p = m.pair[i];
        if (!p) continue;
        const s = m.side[i],
          theta = (p === 1 ? fl + (fr - fl) * s : bl + (br - bl) * s) * m.weight[i],
          // Rotating about +x moves a point below the hip backward for +angle, so negate.
          c = Math.cos(-theta),
          sn = Math.sin(-theta),
          pz = p === 1 ? legs.front[2] : legs.back[2],
          j = i * 3,
          dy = m.rest[j + 1] - hipY,
          dz = m.rest[j + 2] - pz;
        out[j + 1] = hipY + dy * c - dz * sn;
        out[j + 2] = pz + dy * sn + dz * c;
        if (outN && m.restN) {
          const ny = m.restN[j + 1],
            nz = m.restN[j + 2];
          outN[j + 1] = ny * c - nz * sn;
          outN[j + 2] = ny * sn + nz * c;
        }
      }
      m.position.needsUpdate = true;
      if (m.normal) m.normal.needsUpdate = true;
    }
  };
}
