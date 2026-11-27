# Desert Wildlife

This feature owns the built-in animals that give `arid` surface biomes an ecosystem:

- Camels are large passive herd animals that can be fed and bred with Cactus.
- Scorpions pursue nearby players, sting, and can poison them.
- Snakes pursue nearby players and have a stronger venom chance.
- Lizards are small passive animals that flee players and can be bred with Cactus.
- Vultures cruise above desert terrain, avoid nearby players, and drop Feathers.

All creatures register behavior with the central `MobManager`; this feature does not own a separate entity collection or manager. Ground species query the biome's `arid` tag and require Sand. Vultures use lightweight flight behavior above the selected biome profile.
