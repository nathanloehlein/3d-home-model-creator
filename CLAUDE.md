# 3D Home Model Creator: project context

A 3D model and floor plan of one property, with remodel schemes and a Home Assistant floor3d export, all driven by the DATA block in `model.html`. `README.md` documents the data format and the workflows; read it before editing.

## Rules of the model

- `model.html` is the source of truth. All property data lives in the DATA block (`/* DATA:BEGIN */` … `/* DATA:END */`): `PROPERTY` for the house as it stands, then the optional remodel `SCHEMES`.
- `tools/ha_floor3d.mjs` and `tools/scheme.test.mjs` eval the DATA, `WALLS` and `SCHEME` blocks. Keep all three self-contained, with no references to page code outside them.
- Plan feet, plan north up. x = plan east, z = plan south, y = feet above the main floor.
- Walls may be diagonal. Axis-aligned opening `a`/`b` values are global x or z coordinates; diagonal opening values are distances from the wall's first endpoint. For diagonal exterior walls, `out: 1` is right while walking from the first endpoint to the second.
- Use `poly` or `polys` for non-rectangular room floors. Use `PLANE([[x, z, height], ...], thickness)` for roof and ceiling planes; roof heights are absolute, while room ceiling heights are relative to the room level.
- Use `FURNITURE(type, options)` for movable catalog items and keep `fx()` for custom boxes or fixed equipment. Furniture sizes are in inches (`widthIn`, `depthIn`, `heightIn`, `raiseIn`); X and Z positions stay in feet. Preserve the bundled Kenney asset names and CC0 license files when editing the catalog.
- Measured figures beat drawn ones. When an area is measured, put it in the room's `area` so the page stops estimating. Note in a comment where each number came from, and keep the sources in `reference/`.
- Remodel schemes:
  - Never hand-tag new or removed walls; the SCHEME block diffs each scheme against `PROPERTY`.
  - Build scheme lists with `revise(PROPERTY.x, { id: null | {changes} })` plus the new items.
  - After touching the SCHEME or WALLS block, run `npm test`.
- Agree a remodel idea in words before drawing it. Put open questions in the scheme's `checks` so they stay with the drawing.
- Everything outside the DATA block is the renderer, the same in every copy of this project. A renderer fix can be ported between copies by swapping the code around that block.
- In the upstream template, `PROPERTY` and `SCHEMES` stay example data. The tests check the example schemes while they're present and skip those checks once the data is a real house.

## The page itself

- The page has an in-browser furniture editor, keyboard navigation in 3D (WASD, Q/E, R/F) and remembered settings (`hmc-ui-v1`, `hmc-furniture-v1` in localStorage). A saved furniture layout hides edits made in the file, so tell the user to Reset plan after pasting Show-as-code output into the data.
- Furniture editor code and the nav and settings code sit after the renderer's plan code, outside the DATA block. Keep them out of the DATA, WALLS and SCHEME blocks, which the Node tools evaluate.
- Doors are `DOOR(a, b, { hinge, swing })` data; the Doors layer only toggles their swing arcs and slabs.

## Previewing

- `npm start` serves http://localhost:8767/. The page is rebuilt on every request, so reload after an edit.
- `#<scheme>` or `#<scheme>/plan` in the URL opens a scheme and view directly.

## Home Assistant

- The bindings live in `ha/dashboard.yaml` and are pushed by `tools/ha_push_dashboard.py --env <file>`.
- The env file holds `HA_URL` and `HA_TOKEN`. Never commit it, print it or echo the token.
- Installing a HACS card, copying files to the HA box and creating a dashboard all change a live system. Ask before doing any of them.
