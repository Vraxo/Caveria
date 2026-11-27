# Biomes

This feature owns Caveria's surface and cavern biome identities, definitions, selection profiles, and decoration behavior.

- `BiomeTypes.ts` defines the stable typed biome identities.
- `BiomeDefinitions.ts` declares selection, terrain strata, climate, water, fishing, and semantic tags.
- `BiomeDecoratorRegistry.ts` dispatches surface and cavern decoration behavior.
- `DefaultBiomeDecorators.ts` implements the built-in flora and cavern decoration policies.

`world/TerrainGen.ts` remains in world generation because it also owns height fields, caves, ores, aquifers, and chunk traversal. Other features consume biome metadata rather than branching on biome names.
