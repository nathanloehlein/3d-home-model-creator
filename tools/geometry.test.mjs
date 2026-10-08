import test from 'node:test';
import assert from 'node:assert/strict';
import { polygonArea, triangulatePolygon } from './geometry.mjs';

const triangleArea = (points, [a, b, c]) => Math.abs(polygonArea([points[a], points[b], points[c]]));

test('triangulates a concave room footprint without filling its notch', () => {
  const points = [[0, 0], [6, 0], [6, 2], [2, 2], [2, 6], [0, 6]];
  const triangles = triangulatePolygon(points);
  assert.equal(triangles.length, points.length - 2);
  assert.equal(triangles.reduce((sum, triangle) => sum + triangleArea(points, triangle), 0), Math.abs(polygonArea(points)));
});

test('triangulation supports clockwise input', () => {
  const points = [[0, 0], [0, 4], [4, 4], [4, 0]];
  assert.equal(triangulatePolygon(points).length, 2);
});
