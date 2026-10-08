// Builds ha/house.glb for Home Assistant's floor3d-card from the PROPERTY block in model.html.
//
//   node tools/ha_floor3d.mjs                  the house as it stands -> ha/house.glb
//   node tools/ha_floor3d.mjs --scheme plan-a  a remodel scheme from SCHEMES -> ha/house-plan-a.glb
//
// floor3d-card binds entities to objects by name, works in centimetres with Y up, and wants the model's
// top-left corner at 0,0. So plan feet become cm, the north-west corner of everything becomes the origin,
// and grade is y = 0. Objects:
//   walls_exterior, walls_interior, windows, doors, foundation, furniture, paving, lot
//   room_<id>     one floor per room (floor3d's room type wants "room" in the name)
//   light_<...>   a small ceiling disc per entry in PROPERTY.lights, for a light binding to sit on
// Roofs and ceilings are left out so the card shows the house as a dollhouse.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'model.html'), 'utf8');
const between = (a, b) => html.slice(html.indexOf(a) + a.length, html.indexOf(b));

// ---- reuse the page's data and wall builder, with block() collecting boxes instead of meshes
const boxes = [];
const prism = (group, mat, poly, bot, top) => {
  const valueAt = (v, [x, z], i) => Array.isArray(v) ? v[i] : typeof v === 'function' ? v(x, z, i) : v;
  boxes.push({ mat: mat.name, poly, b: poly.map((p, i) => valueAt(bot, p, i)), t: poly.map((p, i) => valueAt(top, p, i)) });
  return {};
};
const block = (group, mat, x0, x1, z0, z1, bot, top) => prism(group, mat, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], bot, top);
// bearing and new-work colours are page-only: in HA they're plain interior wall
const M = { ...Object.fromEntries(['siding', 'wall', 'glass', 'door', 'gdoor'].map((n) => [n, { name: n }])), bearing: { name: 'wall' }, newWall: { name: 'wall' } };
const src = ['DATA', 'WALLS', 'SCHEME'].map((b) => between(`/* ${b}:BEGIN */`, `/* ${b}:END */`)).join('\n');
const { PROPERTY: P, LV, PAL, buildWall, resolveSchemes, SCHEMES, roomPolys } = new Function('block', 'prism', 'M',
  `${src}\nreturn { PROPERTY, LV, PAL, buildWall, resolveSchemes, roomPolys, SCHEMES: typeof SCHEMES === 'undefined' ? {} : SCHEMES };`)(block, prism, M);

// ---- which layout: the existing house, or a scheme's (its own lists; site and lights are shared)
const at = process.argv.indexOf('--scheme');
const schemeId = at > 0 ? process.argv[at + 1] : null;
let L = P;
if (schemeId) {
  const all = resolveSchemes(P, SCHEMES);
  if (!all[schemeId]) {
    console.error(`No scheme "${schemeId}". Schemes: ${Object.keys(all).join(', ')}`);
    process.exit(1);
  }
  L = all[schemeId];
}
for (const w of [...L.ext, ...L.parts]) buildWall(w, null);

// ---- objects: name -> { mat, shapes }
const objects = new Map();
const put = (name, mat, shape) => {
  if (!objects.has(name)) objects.set(name, { mat, shapes: [] });
  objects.get(name).shapes.push(shape);
};
const box = (x0, x1, z0, z1, bot, top) => ({ x0, x1, z0, z1, b: [bot, bot], t: [top, top] });
const WALL_OBJ = { siding: 'walls_exterior', wall: 'walls_interior', glass: 'windows', door: 'doors', gdoor: 'garage_doors' };
for (const b of boxes) put(WALL_OBJ[b.mat], b.mat, b);
for (const [x0, z0, x1, z1] of L.foundation || []) put('foundation', 'found', box(x0, x1, z0, z1, LV.grade, LV.main - 0.06));
const id = (s) => s.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
for (const r of L.rooms) for (const poly of roomPolys(r)) put(`room_${id(r.id)}`, r.mat, { poly, bot: LV[r.lvl] - 0.06, top: LV[r.lvl] });
for (const f of L.fixtures) {
  const [x0, z0, x1, z1] = f.r;
  const y0 = f.y0 + (LV[f.lvl ?? 'main'] ?? 0);
  put('furniture', f.m, box(x0, x1, z0, z1, y0, y0 + f.h));
}
const S = P.site || {};
for (const { mat, r: [x0, z0, x1, z1], y0 = LV.grade, y1 = LV.grade + 0.05 } of S.pads || []) put('paving', mat, box(x0, x1, z0, z1, y0, y1));
if (S.lot) put('lot', 'lawn', { poly: S.lot, bot: LV.grade - 0.3, top: LV.grade - 0.02 });
for (const [name, x, z, top] of P.lights || []) {
  const ring = Array.from({ length: 12 }, (_, i) => [x + 0.6 * Math.cos((i * Math.PI) / 6), z + 0.6 * Math.sin((i * Math.PI) / 6)]);
  put(name, 'fixture', { poly: ring, bot: top - 0.15, top });
}

// ---- origin: the north-west corner of everything, grade at y = 0, centimetres
const corners = [...objects.values()].flatMap((o) => o.shapes.flatMap((s) => (s.poly ? s.poly : [[s.x0, s.z0], [s.x1, s.z1]])));
const OX = Math.min(...corners.map((c) => c[0]));
const OZ = Math.min(...corners.map((c) => c[1]));
const FT = 30.48;
const Pt = (x, y, z) => [(x - OX) * FT, (y - LV.grade) * FT, (z - OZ) * FT];

function faces(shape) {
  if (shape.poly) {
    const pts = shape.poly;
    const bottoms = shape.b ?? pts.map(() => shape.bot);
    const tops = shape.t ?? pts.map(() => shape.top);
    const out = [pts.map(([x, z], i) => Pt(x, tops[i], z)), pts.map(([x, z], i) => Pt(x, bottoms[i], z))];
    for (let i = 0; i < pts.length; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[(i + 1) % pts.length];
      const j = (i + 1) % pts.length;
      out.push([Pt(ax, bottoms[i], az), Pt(bx, bottoms[j], bz), Pt(bx, tops[j], bz), Pt(ax, tops[i], az)]);
    }
    return out;
  }
  const { x0, x1, z0, z1, b, t } = shape;
  const v = { b0: Pt(x0, b[0], z0), b1: Pt(x1, b[1], z0), b2: Pt(x1, b[1], z1), b3: Pt(x0, b[0], z1),
    t0: Pt(x0, t[0], z0), t1: Pt(x1, t[1], z0), t2: Pt(x1, t[1], z1), t3: Pt(x0, t[0], z1) };
  return [
    [v.t0, v.t3, v.t2, v.t1], [v.b0, v.b1, v.b2, v.b3],
    [v.b0, v.t0, v.t1, v.b1], [v.b1, v.t1, v.t2, v.b2], [v.b2, v.t2, v.t3, v.b3], [v.b3, v.t3, v.t0, v.b0],
  ];
}
function normal(poly) {
  // Newell's method, robust for any planar polygon
  const n = [0, 0, 0];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const l = Math.hypot(...n) || 1;
  return n.map((c) => c / l);
}

// ---- glTF
const lin = (hex) => [16, 8, 0].map((s) => {
  const c = ((hex >> s) & 255) / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});
const MATS = { gdoor: { color: PAL.garageDoor ?? 0xd9d8d2 }, glass: { color: PAL.glass, alpha: 0.35 }, lawn: { color: PAL.lawn }, fixture: { color: 0xfff4d6, emissive: 0x6b5d3a } };
const gltf = { asset: { version: '2.0', generator: '3d-home-model-creator/tools/ha_floor3d.mjs' }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], materials: [], accessors: [], bufferViews: [], buffers: [] };
const matIndex = new Map();
function material(key) {
  if (!matIndex.has(key)) {
    const m = MATS[key] ?? { color: PAL[key] ?? 0xcccccc };
    const mat = { name: key, pbrMetallicRoughness: { baseColorFactor: [...lin(m.color), m.alpha ?? 1], metallicFactor: 0, roughnessFactor: 0.9 }, doubleSided: true };
    if (m.alpha) mat.alphaMode = 'BLEND';
    if (m.emissive) mat.emissiveFactor = lin(m.emissive);
    matIndex.set(key, gltf.materials.length);
    gltf.materials.push(mat);
  }
  return matIndex.get(key);
}
const chunks = [];
let offset = 0;
function view(arr, target) {
  const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
  const pad = (4 - (buf.length % 4)) % 4;
  gltf.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, target });
  chunks.push(buf, Buffer.alloc(pad));
  offset += buf.length + pad;
  return gltf.bufferViews.length - 1;
}
for (const [name, obj] of objects) {
  const pos = [];
  const nor = [];
  const idx = [];
  for (const shape of obj.shapes) {
    const fs_ = faces(shape);
    const all = fs_.flat();
    const c = [0, 1, 2].map((k) => all.reduce((s, p) => s + p[k], 0) / all.length);
    for (const poly of fs_) {
      // face normal, flipped to point away from the shape's centre (materials are double-sided anyway)
      let n = normal(poly);
      const fc = [0, 1, 2].map((k) => poly.reduce((s, p) => s + p[k], 0) / poly.length);
      if (n[0] * (fc[0] - c[0]) + n[1] * (fc[1] - c[1]) + n[2] * (fc[2] - c[2]) < 0) n = n.map((v) => -v);
      const base = pos.length / 3;
      for (const p of poly) { pos.push(...p); nor.push(...n); }
      for (let i = 1; i < poly.length - 1; i++) idx.push(base, base + i, base + i + 1);
    }
  }
  const min = [0, 1, 2].map((k) => Math.min(...pos.filter((_, i) => i % 3 === k)));
  const max = [0, 1, 2].map((k) => Math.max(...pos.filter((_, i) => i % 3 === k)));
  const a0 = gltf.accessors.push({ bufferView: view(new Float32Array(pos), 34962), componentType: 5126, count: pos.length / 3, type: 'VEC3', min, max }) - 1;
  const a1 = gltf.accessors.push({ bufferView: view(new Float32Array(nor), 34962), componentType: 5126, count: nor.length / 3, type: 'VEC3' }) - 1;
  const a2 = gltf.accessors.push({ bufferView: view(new Uint32Array(idx), 34963), componentType: 5125, count: idx.length, type: 'SCALAR' }) - 1;
  gltf.meshes.push({ name, primitives: [{ attributes: { POSITION: a0, NORMAL: a1 }, indices: a2, material: material(obj.mat) }] });
  gltf.scenes[0].nodes.push(gltf.nodes.push({ name, mesh: gltf.meshes.length - 1 }) - 1);
}
const bin = Buffer.concat(chunks);
gltf.buffers.push({ byteLength: bin.length });
let json = Buffer.from(JSON.stringify(gltf));
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
const chunk = (type, data) => {
  const h = Buffer.alloc(8);
  h.writeUInt32LE(data.length, 0);
  h.writeUInt32LE(type, 4);
  return Buffer.concat([h, data]);
};
fs.mkdirSync(path.join(ROOT, 'ha'), { recursive: true });
const out = path.join(ROOT, 'ha', schemeId ? `house-${schemeId}.glb` : 'house.glb');
fs.writeFileSync(out, Buffer.concat([header, chunk(0x4e4f534a, json), chunk(0x004e4942, bin)]));
console.log(`wrote ${out}: ${objects.size} objects, ${(bin.length / 1024).toFixed(0)} KB, ${(P.lights || []).length} light discs`);
console.log('objects:', [...objects.keys()].join(' '));
