# Texture Packs

Each subfolder inside `public/texture-packs/<pack-id>/` is a texture pack containing
16×16 block tile PNGs named `tile-<index>.png` (matching `TileIndex`, e.g. `tile-000.png`
for Grass Top, `tile-003.png` for Stone).

## Built-in packs

- **`default/`** — Original Caveria 16×16 block textures (`tile-000.png` through `tile-050.png`), with procedural fallback for any missing tile.
- **`ocd/`** — Minimalist crisp geometric 16×16 textures inspired by the classic oCd pack (`tile-000.png` through `tile-050.png`).

## Adding a custom texture pack

1. Create a new folder under `public/texture-packs/<your-pack-id>/`.
2. Add any `tile-XXX.png` files you want to override (missing tiles automatically fall back to procedural generation). You can export the current atlas tiles from the browser devtools console with `game.atlas.downloadTiles()`.
3. Register the pack in `public/texture-packs/packs.json`:
   ```json
   {
     "id": "my-pack",
     "name": "My Pack",
     "description": "Custom block textures"
   }
   ```
4. Select it in-game under **Options → Texture Pack**.
