// Wraps model.html in a full HTML document.
//
//   node tools/build.mjs            writes _site/index.html (what GitHub Pages serves)
//   node tools/build.mjs out.html   writes somewhere else
//
// model.html is deliberately a body fragment with no <html>/<head>: that's the shape a Claude Artifact takes, and the
// artifact host adds the skeleton when it publishes. Anywhere else, this adds it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export function page() {
  const body = fs.readFileSync(path.join(ROOT, 'model.html'), 'utf8');
  return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n'
    + `${body}\n</body>\n</html>\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = path.resolve(process.argv[2] ?? path.join(ROOT, '_site', 'index.html'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, page());
  const assets = path.join(ROOT, 'assets');
  if (fs.existsSync(assets)) fs.cpSync(assets, path.join(path.dirname(out), 'assets'), { recursive: true });
  console.log(`wrote ${path.relative(process.cwd(), out)}`);
}
