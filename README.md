# Property Model

A 3D model and floor plan of a house, built from one block of data in one HTML file. Draw remodel options against it, and the page works out what each one builds, fills in and takes out. The same data also exports to a GLB for Home Assistant's [floor3d-card](https://github.com/adizanni/floor3d-card).

**[Live demo](https://nathanloehlein.github.io/property-model/)** (an example house with three remodel options)

![Plan A in 3D: new walls in blue, the bearing wall in rust](docs/plan-a-3d.png)
![Plan B floor plan: an addition, with the old window filled in](docs/plan-b-plan.png)

## Features

- **One file, nothing to install.** `model.html` holds the data and the renderer. three.js loads from a CDN. The tooling is plain Node with no dependencies.
- **3D model**: orbit, camera presets and a cut-height slider for seeing inside. Click a room to see its size, level and ceiling.
- **Floor plan**: rooms, fixtures, windows, overall dimensions, north arrows and a scale bar, with one plan per floor.
- **Remodel schemes**: list only what changes, and the page compares it with the house as it stands.
  - New walls and filled-in openings are blue.
  - Walls taken out are dashed.
  - Bearing walls are rust.
  - A built-in Shell option shows the house with every inside wall gone.
- **Room areas** are estimated from the wall lines, or you enter a measured figure.
- **Home Assistant**: a GLB with named objects for floor3d-card, and a script that pushes the dashboard.
- Light and dark themes; works on a phone.

## Quick start

Needs Node 20 or later.

```bash
git clone https://github.com/nathanloehlein/property-model.git my-house
cd my-house
npm start
```

Open http://localhost:8767/, then edit the DATA block in `model.html` and reload.

| Command | What it does |
|---|---|
| `npm start` | Preview server at http://localhost:8767/. It rebuilds the page on every request. |
| `npm run build` | Writes `_site/index.html`, a standalone page. |
| `npm run glb` | Writes `ha/house.glb` for Home Assistant. |
| `npm test` | Tests the scheme diff. |

The URL hash opens a scheme and a view directly, e.g. `#plan-a` or `#plan-b/plan`.

## Modelling your property

Everything about the property lives in `model.html`, between `/* DATA:BEGIN */` and `/* DATA:END */`. The example house there is meant to be replaced.

Measuring tips:

- Take the exterior dimensions first, since they set the frame, and close the loop around the outside.
- Then measure each room wall to wall, and the window and door offsets from a corner.
- A survey, an assessor's sketch or a listing floor plan makes a good starting point.

### Coordinates

Everything is in plan feet with plan north up. Pick any corner of the house as 0,0; the north-west outer corner is easiest.

- x = plan east, z = plan south.
- y = feet above the main floor. `LV.grade` is the ground, usually −1 to −2 ft.
- `PROPERTY.trueNorth` is how many degrees true north sits clockwise from plan north. It draws the TRUE N arrow.

### Exterior walls (`ext`)

Each wall is `{ x0, z0, x1, z1, out, open }`, drawn along the wall's outside face.

- A wall is horizontal when `z0 === z1`.
- `out` is the side that faces outside: −1 means toward −x or −z, 1 means toward +x or +z. The wall's thickness is built inward from its line.
- `t` sets the thickness. The default is 0.5 ft for exterior walls and 0.35 ft for interior walls.
- `top` sets the wall's height (default `WALL_H`). It can be a function of x, for a sloped wall top.

### Interior walls (`parts`)

These take the same fields as exterior walls, without `out`. They're drawn on their centerline.

- `bearing: true` marks a wall that carries the roof or floor above. It's drawn in rust, and when a scheme takes it out the dashed line stays rust, meaning it needs a beam or posts.
- `id` is optional on any wall, room or fixture. It lets a scheme `revise()` that item.
- Stop interior walls at the inside face of the outside walls; one that runs to the outer line shows through the siding.

### Openings (`open`)

Openings are measured along the wall, from `a` to `b`, in the same plan feet:

| Helper | What it draws |
|---|---|
| `WIN(a, b, sill, head)` | A window |
| `DOOR(a, b)` | A solid door |
| `OPEN(a, b)` | A gap with a header above it |
| `GDOOR(a, b)` | A garage door, 7′ high |

### Levels and floor plans

- `LV` holds the floor heights, e.g. `{ main: 0, garage: -0.6, upper: 9.5, grade: -1.5 }`.
- Walls, rooms and fixtures take `lvl` (default `main`).
- A wall's base is its level, and its default top is the base plus `WALL_H`.
- `PLANS` lists the 2D plans and which levels each one shows, e.g. `{ main: { name: 'Main floor', lvls: ['main', 'garage'] }, upper: { name: 'Upper floor', lvls: ['upper'] } }`.
  - The floor switch appears when there's more than one plan.
  - The other plans' outside walls are drawn dashed.

### Rooms (`rooms`)

Each room is `{ id, name, lvl, mat, rects: [[x0, z0, x1, z1], …], at: [x, z] }`.

- `rects` are wall centerlines. The page subtracts a wall allowance to get the floor area. Give `area` instead if you have a measured figure.
- `mat` picks the floor colour: woodMain, carpet, tile, wet, closet, mech or conc.
- `at` places the label. A room without one, such as a closet, gets no label and stays out of the room list.
- `ceilH` (a height) or `ceil` (a description) describes the ceiling. `sub` and `note` add lines to the selected-room panel.

### Everything else

- `fixtures` are made with `fx(label, [x0, z0, x1, z1], height, material, base, extra)`. Put `{ fixed: true }` in `extra` for things that stay put in any remodel (furnace, panel, meters); the Shell keeps only those.
- `foundation`, `roofs` and the `site` (ground, lot polygon, paving pads, labels) are optional.
- `facts` and `notes` fill the sidebar.
- `lights` are the Home Assistant light positions: `[name, x, z, height]`.

## Remodel schemes

Remodel options live in `SCHEMES`, right after `PROPERTY` in the DATA block. Without any, the page is just the existing house. With some, a Scheme switcher appears: **Existing**, then each scheme in order.

```js
const SCHEMES = {
  shell: { name: 'Shell', shell: true },
  'plan-a': {
    name: 'Plan A',
    summary: 'One or two sentences on the idea.',
    parts: [
      ...revise(PROPERTY.parts, { 'living-s': { x1: 14, open: [] }, 'old-closet': null }),
      { id: 'new-wall', x0: 32, z0: 24, x1: 40, z1: 24, open: [OPEN(34, 37)] },
    ],
    rooms: [...revise(PROPERTY.rooms, { 'bed-1': null }), { id: 'den', name: 'Den', sub: 'was bedroom 1', /* … */ }],
    scope: ['Work involved, one line per item.'],
    checks: ['Open questions: engineer, permits, budget.'],
  },
};
```

- **Inheritance.** A scheme replaces only the lists it names: `ext`, `parts`, `rooms`, `fixtures`, `foundation`, `roofs`, `dims`. Everything else is the existing house. The site and the Home Assistant lights are shared by every scheme.
- **`revise(list, edits)`** copies an existing list by `id`. `{ id: null }` drops that item and `{ id: { ...fields } }` changes some of its fields. Spread it and add new items after it.
- **New work is worked out, not tagged.** Each scheme's walls are compared with the existing ones:
  - Blue: wall where there was none, and old openings that are now filled in. In the plan, a window that wasn't there before gets a blue outline.
  - Dashed: wall stretches the scheme takes out. Rust dashes mean the wall was bearing.
  - Two walls are the same wall when they run the same way on the same level and their thicknesses overlap. So an old outside wall kept as an inside wall in an addition can move into `parts` and still match. Plan B in the example does this.
  - `isNew: true` on a wall or opening forces it to count as new. A room counts as new when its `id` is new or its `rects` changed; `isNew` on a room overrides that.
- **Shell.** `shell: true` starts from the house with every inside wall gone. It keeps only `fixed` fixtures, and has one room per level that keeps each old room's ceiling height.
- **Additions.** Change `ext`, and add the new footprint to `foundation` and `roofs`. The 2D frame fits every scheme, so plans line up when you switch.
- **`existing` is a reserved id.**
- **Once a scheme is built**, move its lists into `PROPERTY`. It is now the house as it stands.

The diff lives in the SCHEME block of `model.html` and needs only the DATA and WALLS blocks, so the Node tools can evaluate it too. `npm test` covers it.

## Home Assistant 3D

1. Run `npm run glb` to write `ha/house.glb`.
   - It contains these objects: `walls_exterior`, `walls_interior`, `windows`, `doors`, `foundation`, `furniture`, `paving`, `lot`, `room_<id>`, and one `light_<…>` disc per entry in `PROPERTY.lights`.
   - Units are cm and Y is up. The north-west corner of everything is the origin, which is what floor3d-card expects.
   - `node tools/ha_floor3d.mjs --scheme plan-a` exports a scheme to `ha/house-plan-a.glb` instead, without the new-work colouring.
   - `npm start`, then http://localhost:8767/ha/_view.html, checks that the GLB loads.
2. In Home Assistant, install floor3d-card from HACS (adizanni/floor3d-card).
3. Copy `ha/house.glb` to `/config/www/property3d/house.glb`. It's served as `/local/property3d/house.glb`. The folder name must match `path` in `ha/dashboard.yaml`.
4. Edit `ha/dashboard.yaml` and replace the placeholder entity ids, one binding per light disc.
5. Put `HA_URL=…` and `HA_TOKEN=…` (a long-lived access token) in `.env`, which git ignores. Then push the dashboard:

   ```bash
   pip install websockets pyyaml
   python tools/ha_push_dashboard.py --env .env --url-path property-3d --title "Property 3D"
   ```

A single click on a disc toggles its entity, and a drag orbits. Lights render with their HA colour and brightness.

## Publishing

- **GitHub Pages.** `.github/workflows/pages.yml` tests, builds and deploys the page on every push to `main`. Turn it on under *Settings → Pages → Source: GitHub Actions*. Remember that the published page shows your house's layout.
- **Claude Artifacts.** `model.html` is a body fragment, with no `<html>` or `<head>`, so it can be published as a [Claude](https://claude.ai) Artifact as it is. `npm run build` adds the document skeleton for everywhere else.

## Working with Claude Code

`CLAUDE.md` holds the model's rules, so [Claude Code](https://claude.com/claude-code) can do the data entry. Hand it measurements, a survey or listing floor plans, and ask it to fill in the DATA block or draft a remodel scheme.

## Project layout

```
model.html               the page: data (DATA block), wall builder (WALLS), scheme diff (SCHEME), renderer
tools/serve.mjs          preview server
tools/build.mjs          model.html -> _site/index.html
tools/ha_floor3d.mjs     model.html -> ha/house.glb
tools/scheme.test.mjs    tests for the scheme diff
tools/ha_push_dashboard.py  pushes ha/dashboard.yaml to Home Assistant
ha/dashboard.yaml        floor3d-card dashboard with placeholder entities
ha/_view.html            standalone check that ha/house.glb loads
reference/               for your measurements, survey and photos
```

## Limitations

- Walls must be axis-aligned; diagonal walls aren't supported yet.
- Roofs are flat slabs. Hip and gable roofs and sloped ceilings aren't built in, though a wall's `top` can follow a slope.
- Doors are drawn as gaps in the floor plan, without swings.

## License

[MIT](LICENSE)
