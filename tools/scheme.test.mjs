// Tests for the scheme diff in model.html's SCHEME block, run against the page's own code.
//
//   npm test
//
// Most tests build their own walls. The ones that check the example schemes skip once PROPERTY is a real house.
// Like ha_floor3d.mjs, it evals the DATA, WALLS and SCHEME blocks; block() and M are stubs since nothing is drawn.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'model.html'), 'utf8');
const between = (a, b) => html.slice(html.indexOf(a) + a.length, html.indexOf(b));
const src = ['DATA', 'WALLS', 'SCHEME'].map((b) => between(`/* ${b}:BEGIN */`, `/* ${b}:END */`)).join('\n');
const names = ['PROPERTY', 'WIN', 'DOOR', 'OPEN', 'revise', 'mergeSpans', 'cutSpans', 'diffWalls', 'resolveSchemes'];
const K = new Function('block', 'M',
  `${src}\nreturn { ${names.join(', ')}, SCHEMES: typeof SCHEMES === 'undefined' ? {} : SCHEMES };`)(() => ({}), {});
const { PROPERTY: P, WIN, OPEN, DOOR } = K;
const SCH = K.resolveSchemes(P, K.SCHEMES);
// skip reason for the tests that check the example schemes, or false while the example data is in place
const EXAMPLE = P.name === 'Example house' && SCH['plan-a'] && SCH['plan-b'] ? false : 'PROPERTY is not the example house';

const hwall = (x0, x1, z, extra = {}) => ({ x0, z0: z, x1, z1: z, ...extra });

test('spans merge and cut', () => {
  assert.deepEqual(K.mergeSpans([[5, 6], [1, 3], [2, 4]]), [[1, 4], [5, 6]]);
  assert.deepEqual(K.cutSpans([[0, 10]], [[2, 3], [8, 12]]), [[0, 2], [3, 8]]);
  assert.deepEqual(K.cutSpans([[0, 10]], [[0, 4], [4, 10]]), []);
});

test('revise drops, patches and keeps', () => {
  const out = K.revise([{ id: 'a', v: 1 }, { id: 'b', v: 2 }, { v: 3 }], { a: null, b: { v: 9 } });
  assert.deepEqual(out, [{ id: 'b', v: 9 }, { v: 3 }]);
});

test('the existing house has no changes against itself', () => {
  const S = SCH.existing;
  assert.deepEqual(S.removed, []);
  for (const w of S.walls) {
    assert.deepEqual(w.fresh, [], `wall ${w.id}`);
    for (const o of w.open) assert.equal(o.isNew, false, `opening in ${w.id}`);
  }
  assert.ok(S.rooms.every((r) => !r.isNew));
});

test('a shortened wall reports the stretch taken out', () => {
  const { walls, removed } = K.diffWalls([hwall(0, 24, 16)], [hwall(0, 14, 16)]);
  assert.deepEqual(walls[0].fresh, []);
  assert.deepEqual(removed.map((r) => [r.a0, r.a1]), [[14, 24]]);
});

test('a wall where there was none is new along its whole length', () => {
  const { walls, removed } = K.diffWalls([], [hwall(32, 40, 24)]);
  assert.deepEqual(walls[0].fresh, [[32, 40]]);
  assert.deepEqual(removed, []);
});

test('closing an opening counts as new work', () => {
  const before = [hwall(0, 40, 28, { out: 1, open: [WIN(34, 38)] })];
  const { walls } = K.diffWalls(before, [hwall(0, 40, 28, { out: 1 })]);
  assert.deepEqual(walls[0].fresh, [[34, 38]]);
});

test('a moved window: the old part filled in, the new one tagged', () => {
  const before = [hwall(0, 40, 0, { out: -1, open: [WIN(4, 10), WIN(20, 24)] })];
  const { walls } = K.diffWalls(before, [hwall(0, 40, 0, { out: -1, open: [WIN(6, 12), WIN(20, 24)] })]);
  assert.deepEqual(walls[0].fresh, [[4, 6]]);
  assert.deepEqual(walls[0].open.map((o) => o.isNew), [true, false]);
});

test('a door in place of a window is a new opening', () => {
  const before = [hwall(0, 10, 0, { out: -1, open: [WIN(4, 7)] })];
  const { walls } = K.diffWalls(before, [hwall(0, 10, 0, { out: -1, open: [DOOR(4, 7)] })]);
  assert.equal(walls[0].open[0].isNew, true);
  assert.deepEqual(walls[0].fresh, []);
});

test('an outside wall kept as an inside wall is the same wall', () => {
  const before = [hwall(0, 40, 0, { out: -1, open: [WIN(28, 34)] })];
  const after = [hwall(0, 28, 0, { out: -1 }), hwall(28, 40, 0.25, { t: 0.5, open: [OPEN(36.6, 39.2)] })];
  const { walls, removed } = K.diffWalls(before, after);
  assert.deepEqual(removed, []);
  assert.deepEqual(walls[0].fresh, []);
  assert.deepEqual(walls[1].fresh, [[28, 34]]);
  assert.equal(walls[1].open[0].isNew, true);
});

test('walls on different levels never match', () => {
  const { walls, removed } = K.diffWalls([hwall(0, 10, 10)], [hwall(0, 10, 10, { lvl: 'upper' })]);
  assert.deepEqual(walls[0].fresh, [[0, 10]]);
  assert.equal(removed.length, 1);
});

test('isNew on a wall marks all of it', () => {
  const { walls } = K.diffWalls([hwall(0, 10, 10)], [hwall(0, 10, 10, { isNew: true })]);
  assert.deepEqual(walls[0].fresh, [[0, 10]]);
});

test('the shell takes out every inside wall and keeps fixed fixtures', () => {
  const S = K.resolveSchemes(P, { shell: { name: 'Shell', shell: true } }).shell;
  assert.equal(S.parts.length, 0);
  assert.equal(S.removed.length, P.parts.length);
  assert.equal(S.removed.filter((r) => r.bearing).length, P.parts.filter((w) => w.bearing).length);
  assert.deepEqual(S.fixtures.map((f) => f.t), P.fixtures.filter((f) => f.fixed).map((f) => f.t));
  assert.equal(S.rooms.length, new Set(P.rooms.map((r) => r.lvl)).size);
  assert.equal(S.rooms.reduce((n, r) => n + r.rects.length, 0), P.rooms.reduce((n, r) => n + r.rects.length, 0));
  assert.ok(S.rooms.every((r) => r.rects.every((q) => q.length === 5)), 'each rect carries its old ceiling height');
  assert.ok(S.rooms.every((r) => !r.isNew));
  assert.match(S.summary, /inside wall/);
});

test('example Plan A: interior changes are found', { skip: EXAMPLE }, () => {
  const S = SCH['plan-a'];
  const wall = (id) => S.walls.find((w) => w.id === id);
  assert.deepEqual(S.removed.map((r) => [r.a0, r.a1, r.bearing]), [[14, 24, false]]);
  assert.deepEqual(wall('spine').fresh, [[11, 12.8]]);
  assert.deepEqual(wall('spine').open.map((o) => o.isNew), [true, false]);
  assert.deepEqual(wall('south').fresh, [[34, 38]]);
  assert.deepEqual(wall('east').open.map((o) => o.isNew), [false, true]);
  assert.deepEqual(wall('mud-cl').fresh, [[32, 40]]);
  const isNew = Object.fromEntries(S.rooms.map((r) => [r.id, r.isNew]));
  assert.equal(isNew.den, true);
  assert.equal(isNew.mud, true);
  assert.equal(isNew.living, false);
  assert.equal(isNew['bed-1'], undefined);
});

test('example Plan B: the addition is new and nothing is taken out', { skip: EXAMPLE }, () => {
  const S = SCH['plan-b'];
  const wall = (id) => S.walls.find((w) => w.id === id);
  assert.deepEqual(S.removed, []);
  assert.deepEqual(wall('east').fresh, [[-8, 0]]);
  assert.deepEqual(wall('add-n').fresh, [[28, 40]]);
  assert.deepEqual(wall('add-w').fresh, [[-8, 0]]);
  assert.deepEqual(wall('suite').fresh, [[28, 34]]);
  assert.deepEqual(wall('north').fresh, []);
  assert.equal(S.foundation.length, P.foundation.length + 1);
  assert.equal(S.rooms.find((r) => r.id === 'ensuite').isNew, true);
  assert.equal(S.rooms.find((r) => r.id === 'bed-1').isNew, false);
});

test('a scheme inherits every list it does not name', () => {
  const S = K.resolveSchemes(P, { x: { name: 'X' } }).x;
  for (const k of ['ext', 'parts', 'fixtures', 'foundation', 'roofs']) assert.equal(S[k], P[k], k);
  // rooms are copies, so each scheme can give them their own material
  assert.deepEqual(S.rooms.map((r) => r.id), P.rooms.map((r) => r.id));
  assert.deepEqual(S.scope, []);
  assert.deepEqual(S.checks, []);
});
