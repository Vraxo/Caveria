# Content catalogs

Caveria keeps declarative game content in typed TypeScript catalogs and keeps behavior in gameplay modules.

- `items/` contains categorized item definitions and validates them in `ItemRegistry.ts`.
- `recipes/` contains crafting groups, cooking recipes, fuel values, and registry validation.
- `loot/` contains weighted loot tables and contextual weight modifiers.
- `effects/` contains status-effect identity, display metadata, and persistence bounds.
- Block definitions remain split between the existing base, biome, and cavern catalogs.

Stable numeric IDs stay in `items/ItemTypes.ts` because saved worlds persist them. Never renumber or reuse an existing item ID. New catalogs should be declarative, typed, and validated at registry construction; state machines, physics, inventory mutations, and effect ticking remain in their gameplay modules.
