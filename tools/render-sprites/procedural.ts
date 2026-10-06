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
