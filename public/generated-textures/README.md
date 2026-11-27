# Generated textures

Block tile PNGs exported from the running game. To export them, open the running
game in a browser, open the devtools console, and call
`game.atlas.downloadTiles()` — the files are then downloaded (one `tile-XXX.png`
each) into your downloads folder; move the good ones to
`public/generated-textures/tiles/`.

While files exist in `public/generated-textures/tiles/`, the game loads them on
startup instead of generating the tiles procedurally. Missing files are skipped,
so you can add the good ones and keep generating the rest.

Filenames are `tile-<index>.png` (e.g. `tile-003.png`), matching `TileIndex`.
Delete a file to go back to procedural generation for that tile.
