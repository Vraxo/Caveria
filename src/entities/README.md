# Mob runtime

Caveria models creatures as individual `MobEntity` records owned by one `MobManager`.

## Ownership

`MobManager` owns cross-species infrastructure:

- globally unique entity IDs;
- instance storage and lifecycle iteration;
- spawning and removal APIs;
- proximity, tag, count, and raycast queries;
- damage gating, health reduction, and death removal.

A registered `MobSpeciesBehavior` owns only species-specific policy and feedback:

- behavior state and decisions;
- spawn timing and environmental spawn rules;
- movement intentions and collision reactions;
- attacks and sounds;
- visual creation, animation, and disposal;
- damage reactions, death particles, and loot.

`MobMechanics.ts` contains stateless mechanics shared through composition, including ground movement, body collision, raycasting, and ground-spawn searches.

## Adding a species

1. Add its stable definition to `content/mobs/MobDefinitions.ts`.
2. Implement `MobSpeciesBehavior<TState, TVisual>` in a species file.
3. Keep only behavior-specific fields in `TState`; position, velocity, health, age, and hurt timing already live on `MobEntity`.
4. Use `MobRuntime.spawn` to create instances. Do not add a species-owned entity array or a second manager.
5. Register one species behavior with `MobManager` in `Game`.

This is intentionally a lightweight component-style runtime rather than a deep entity inheritance hierarchy or a full ECS.
