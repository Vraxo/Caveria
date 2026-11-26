import * as THREE from 'three';
import { AudioManager } from '../../audio/AudioManager';
import { BlockId } from '../../content/BlockId';
import { ItemId, createStack, getFoodStats } from '../../items/Item';
import { Player } from '../../player/Player';
import { PlayerVitals } from '../../player/PlayerVitals';
import { VoxelHit } from '../../player/Raycaster';
import { ConsumableActionRegistry } from '../ConsumableActionRegistry';
import { FarmUseResult } from '../FarmingManager';
import { FishingManager } from '../FishingManager';
import { WaterSurvivalSystem } from '../WaterSurvivalSystem';
import { UseInteractionRegistry } from './UseInteractionRegistry';

interface DefaultUseHandlerDependencies {
  player: Player;
  vitals: PlayerVitals;
  audio: AudioManager;
  fishing: FishingManager;
  waterSurvival: WaterSurvivalSystem;
  consumables: ConsumableActionRegistry;
  onUseFarm: (x: number, y: number, z: number, held: ItemId | null) => FarmUseResult;
  onOpenWorkbench: () => void;
  onOpenFurnace: (x: number, y: number, z: number) => void;
  onOpenChest: (x: number, y: number, z: number) => void;
  onUseBed: (x: number, y: number, z: number) => void;
}

export function createDefaultUseRegistry(
  deps: DefaultUseHandlerDependencies
): UseInteractionRegistry {
  const registry = new UseInteractionRegistry();
  const blockActions = createBlockActionRegistry(deps);

  registry.register((context) => {
    if (context.held?.id !== ItemId.FishingRod) return null;
    const fishingResult = deps.fishing.use(
      deps.player.getEyePosition(),
      deps.player.getForwardDirection()
    );
    let worldDrop;
    if (fishingResult.catchStack && fishingResult.catchPosition) {
      const travelTime = 0.7;
      const dropDrag = -Math.log(0.18);
      const dragTravel = (1 - Math.exp(-dropDrag * travelTime)) / dropDrag;
      const velocity = deps.player.getEyePosition()
        .sub(fishingResult.catchPosition)
        .multiplyScalar(1 / dragTravel);
      velocity.y += 10 * travelTime;
      worldDrop = {
        position: fishingResult.catchPosition.clone().add(new THREE.Vector3(0, 0.25, 0)),
        stack: fishingResult.catchStack,
        velocity,
        pickupDelay: 0.3,
      };
    }
    return {
      damageHeld: fishingResult.rodWear && !context.creativeMode,
      exhaustion: fishingResult.rodWear && !context.creativeMode ? 0.025 : 0,
      animation: 'place',
      worldDrop,
    };
  });

  registry.register((context) => {
    if (!context.allowWorldUse || !context.sneaking) return null;
    if (context.waterHit && !context.held) {
      deps.waterSurvival.drinkSource(
        context.waterHit.blockX,
        context.waterHit.blockY,
        context.waterHit.blockZ
      );
      return { animation: 'place' };
    }
    if (context.waterHit && context.held?.id === ItemId.GlassBottle) {
      const item = deps.waterSurvival.fillBottle(
        context.waterHit.blockX,
        context.waterHit.blockY,
        context.waterHit.blockZ
      );
      return {
        consumeHeld: !context.creativeMode,
        inventoryItem: createStack(item),
        animation: 'place',
      };
    }
    if (!context.waterHit && context.held?.id === ItemId.GlassBottle) {
      const item = deps.waterSurvival.collectRain();
      if (item !== null) {
        return {
          consumeHeld: !context.creativeMode,
          inventoryItem: createStack(item),
          animation: 'place',
        };
      }
    }
    return null;
  });

  registry.register((context) => {
    if (!context.allowWorldUse || !context.hit || context.sneaking) return null;
    const result = deps.onUseFarm(
      context.hit.blockX,
      context.hit.blockY,
      context.hit.blockZ,
      context.held?.id ?? null
    );
    if (result === 'none') return null;
    deps.audio.playFarmAction(result);
    return {
      consumeHeld: !context.creativeMode && result === 'planted',
      damageHeld: !context.creativeMode && result === 'tilled',
      animation: 'place',
      refreshTarget: true,
    };
  });

  registry.register((context) => {
    if (!context.allowWorldUse || !context.hit || context.sneaking) return null;
    const action = blockActions.get(context.hit.blockId);
    if (!action) return null;
    action(context.hit);
    return {};
  });

  registry.register((context) => {
    if (!context.held) return null;
    const definition = deps.consumables.consumeDirect(context.held.id);
    if (!definition) return null;
    return {
      consumeHeld: !context.creativeMode,
      returnedItem: context.creativeMode ? undefined : definition.returnedItem,
      cooldown: definition.cooldownSeconds,
      animation: 'place',
    };
  });

  registry.register((context) => {
    const food = getFoodStats(context.held);
    if (!context.held || !food) return null;
    if (context.foodCooldown > 0) return {};
    if (!deps.vitals.eat(food.nutrition, food.saturation)) return null;
    deps.audio.playEat();
    deps.consumables.afterFood(context.held.id);
    return {
      consumeHeld: !context.creativeMode,
      cooldown: 0.55,
      animation: 'place',
    };
  });

  return registry;
}

function createBlockActionRegistry(
  deps: DefaultUseHandlerDependencies
): ReadonlyMap<BlockId, (hit: VoxelHit) => void> {
  return new Map<BlockId, (hit: VoxelHit) => void>([
    [BlockId.CraftingTable, () => deps.onOpenWorkbench()],
    [BlockId.Furnace, (hit) => deps.onOpenFurnace(hit.blockX, hit.blockY, hit.blockZ)],
    [BlockId.LitFurnace, (hit) => deps.onOpenFurnace(hit.blockX, hit.blockY, hit.blockZ)],
    [BlockId.Campfire, (hit) => deps.onOpenFurnace(hit.blockX, hit.blockY, hit.blockZ)],
    [BlockId.LitCampfire, (hit) => deps.onOpenFurnace(hit.blockX, hit.blockY, hit.blockZ)],
    [BlockId.BedFoot, (hit) => deps.onUseBed(hit.blockX, hit.blockY, hit.blockZ)],
    [BlockId.BedHead, (hit) => deps.onUseBed(hit.blockX, hit.blockY, hit.blockZ)],
    [BlockId.Chest, (hit) => deps.onOpenChest(hit.blockX, hit.blockY, hit.blockZ)],
  ]);
}
