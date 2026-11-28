# Desert Wildlife

This feature owns the built-in animals that give `arid` surface biomes an ecosystem:

- Camels are large passive herd animals that can be fed and bred with Cactus. Adult Camels can be mounted with an empty-hand interaction, ridden with normal movement controls, sprinted with Control, jumped with Space, and dismounted with Shift. Sneak-interacting opens 18 persistent storage slots; using storage or riding marks the Camel persistent, and stored items drop if it dies.
- Scorpions emerge and spawn at night, pursue nearby players, sting, and can poison them; during daylight they burrow into the sand and become inactive.
- Snakes wait motionless in ambush until a player enters striking range, then pursue and attack with a stronger venom chance.
- Lizards are small passive animals that bask motionless through the hot day, forage after sunset, flee players, and can be bred with Cactus.
- Vultures cruise above desert terrain, avoid nearby players, descend toward dropped raw meat and fish, and drop Feathers.

All creatures register behavior with the central `MobManager`; this feature does not own a separate entity collection or manager. Ground species query the biome's `arid` tag and require Sand. Vultures use lightweight flight behavior above the selected biome profile.

Desert Wildlife is an optional, per-world mob pack. New worlds enable it by default, but it can be unchecked during world creation. The profile is persisted with the world; old saves without a profile keep the default enabled behavior. When disabled, the pack's behavior modules and Camel riding controller are dynamically imported only if the profile selects them. If a saved world contains snapshots for these species while the pack is off, the snapshots remain dormant in the save and are restored if the pack is enabled again.
