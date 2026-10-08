const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

export function polygonArea(points) {
  return points.reduce((sum, [x, y], i) => {
    const next = points[(i + 1) % points.length];
    return sum + x * next[1] - next[0] * y;
  }, 0) / 2;
}

function insideTriangle(point, a, b, c, orientation) {
  const epsilon = 1e-9;
  return cross(a, b, point) * orientation >= -epsilon
    && cross(b, c, point) * orientation >= -epsilon
    && cross(c, a, point) * orientation >= -epsilon;
}

export function triangulatePolygon(points) {
  if (points.length < 3) return [];
  const orientation = Math.sign(polygonArea(points)) || 1;
  const remaining = points.map((_, index) => index);
  const triangles = [];
  let guard = points.length * points.length;
  while (remaining.length > 3 && guard-- > 0) {
    let clipped = false;
    for (let i = 0; i < remaining.length; i++) {
      const a = remaining[(i - 1 + remaining.length) % remaining.length];
      const b = remaining[i];
      const c = remaining[(i + 1) % remaining.length];
      if (cross(points[a], points[b], points[c]) * orientation <= 1e-9) continue;
      const containsPoint = remaining.some((index) => index !== a && index !== b && index !== c
        && insideTriangle(points[index], points[a], points[b], points[c], orientation));
      if (containsPoint) continue;
      triangles.push([a, b, c]);
      remaining.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) throw new Error('Polygon must be simple and non-self-intersecting');
  }
  if (remaining.length === 3) triangles.push([...remaining]);
  return triangles;
}
