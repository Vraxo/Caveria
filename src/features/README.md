# World feature profiles

Feature profiles are saved per world because mob availability and future biome/mechanics choices affect world identity. `WorldFeatureProfile` is versioned independently from the broader save format; saves without a profile normalize to the current default profile.

The first optional pack is `desert-wildlife`. It is selected when creating a world and loaded with dynamic imports during asynchronous world initialization. When absent from the profile, its species behaviors and Camel riding controller are not imported, constructed, or registered. The existing core mob species remain enabled in this first slice.

To add another optional pack:

1. Add its stable ID to `MOB_PACK_IDS` and normalize it in `WorldFeatureProfile.ts`.
2. Add a world-creation control and include the profile in the new-world URL.
3. Load the pack only inside its enabled-profile branch using `import()`.
4. Register its species before restoring saved mobs.
5. Add profile normalization, old-save defaulting, and enabled/disabled loading tests.

Do not use user settings for world feature selection: settings are machine preferences, while the profile is part of a world's saved rules. When adding packs with required services or cross-pack references, validate dependencies before initialization rather than allowing missing systems to fail later at runtime.
