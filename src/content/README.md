# Content catalogs

Caveria keeps declarative game content in typed TypeScript catalogs and keeps behavior in gameplay modules.

- `items/` contains categorized item definitions and validates them in `ItemRegistry.ts`.
- `recipes/` contains crafting groups, cooking recipes, fuel values, and registry validation.
- `loot/` contains fishing, mob, and block loot tables plus deterministic weighted rollers.
- `effects/` contains status-effect identity, display metadata, and persistence bounds.
- `consumables/` maps consumable items to action IDs, sounds, cooldowns, and returned containers.
- `mobs/` contains species identity, tags, physical stats, population limits, and loot-table references.
- `crops/` declares stable crop IDs, planting items, ordered stage blocks, growth timing, harvest yields, and break drops.
- Block definitions remain split between the existing base, biome, and cavern catalogs and declare semantic use, break, support, loot, heat, hazard, and replacement capabilities. Conventional blocks default to dropping themselves; transformed, weighted, no-drop, multi-pool, and support-loss outcomes are explicit data.

Stable numeric IDs stay in `items/ItemTypes.ts` because saved worlds persist them. Never renumber or reuse an existing item ID. New catalogs should be declarative, typed, and validated at registry construction; state machines, physics, inventory mutations, and effect ticking remain in their gameplay modules.
