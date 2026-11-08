// Packs assets/furniture/kenney/*.glb into models.json (name -> base64).
//
//   npm run pack
//
// Artifact hosts don't serve .glb files, so the page falls back to this JSON when it can't fetch a model directly.
// GitHub Pages and the local server serve the .glb files fine, so this is only needed when publishing as an artifact.
// models.json is generated and git-ignored; run this again whenever a model changes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'furniture', 'kenney');
const pack = {};
for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.glb')).sort()) pack[name] = fs.readFileSync(path.join(dir, name)).toString('base64');
const out = path.join(dir, 'models.json');
fs.writeFileSync(out, JSON.stringify(pack));
console.log(`wrote ${path.relative(process.cwd(), out)}: ${Object.keys(pack).length} models, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
