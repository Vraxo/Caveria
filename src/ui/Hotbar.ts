import { Input } from '../core/Input';
import { HOTBAR_SIZE, Inventory } from '../items/Inventory';
import { ITEMS, ItemId, ItemStack, createStack } from '../items/Item';
import { TextureAtlas } from '../rendering/TextureAtlas';
import { BlockId } from '../content/BlockId';

export class Hotbar {
  private readonly inventory: Inventory;
  private readonly atlas: TextureAtlas;
  private readonly containerEl: HTMLElement;
  private readonly labelEl: HTMLElement;
  private readonly slotEls: HTMLElement[] = [];

  public selectedIndex = 0;

  constructor(inventory: Inventory, atlas: TextureAtlas) {
    this.inventory = inventory;
    this.atlas = atlas;
    this.containerEl = document.getElementById('hotbar')!;
    this.labelEl = document.getElementById('selected-block-label')!;

    this.buildDomSlots();
    this.inventory.onChange(() => this.refresh());
    this.refresh();
  }

  public get selectedStack(): ItemStack | null {
    return this.inventory.getSlot(this.selectedIndex);
  }

  public update(input: Input): void {
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      if (input.consumeKeyPress(`Digit${i + 1}`)) {
        this.selectIndex(i);
      }
    }

    if (input.wheelDelta !== 0) {
      const next =
        (((this.selectedIndex + Math.sign(input.wheelDelta)) % HOTBAR_SIZE) + HOTBAR_SIZE) %
        HOTBAR_SIZE;
      this.selectIndex(next);
    }
  }

  public selectIndex(idx: number): void {
    this.selectedIndex = idx;
    this.refresh();
  }

  /** Middle-click pick-block helper (selects if in hotbar, or spawns in Creative mode) */
  public pickBlock(blockId: BlockId, creativeMode: boolean): void {
    if (blockId === BlockId.Air || blockId === BlockId.Water || blockId === BlockId.Bedrock) {
      return;
    }
    const targetItemId = blockId as unknown as ItemId;
    if (!ITEMS[targetItemId]) return;

    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const s = this.inventory.getSlot(i);
      if (s && s.id === targetItemId) {
        this.selectIndex(i);
        return;
      }
    }

    if (creativeMode) {
      this.inventory.setSlot(this.selectedIndex, createStack(targetItemId, 64));
      this.selectIndex(this.selectedIndex);
    }
  }

  public refresh(): void {
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slotEl = this.slotEls[i];
      slotEl.classList.toggle('active', i === this.selectedIndex);
      renderItemStackIntoSlot(slotEl, this.inventory.getSlot(i), this.atlas, String(i + 1));
    }

    const cur = this.selectedStack;
    const definition = cur ? ITEMS[cur.id] : null;
    this.labelEl.textContent = definition
      ? `${definition.name}${definition.nutrition ? ` · +${definition.nutrition} hunger` : ''}`
      : 'Empty Hand';
  }

  private buildDomSlots(): void {
    this.containerEl.innerHTML = '';
    this.slotEls.length = 0;

    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot';
      this.containerEl.appendChild(slot);
      this.slotEls.push(slot);
    }
  }
}

/**
 * Shared crisp DOM renderer for an ItemStack inside any Hotbar, Backpack, Crafting, or Cursor slot.
 */
export function renderItemStackIntoSlot(
  slotEl: HTMLElement,
  stack: ItemStack | null,
  atlas: TextureAtlas,
  keyHint?: string
): void {
  slotEl.innerHTML = '';

  if (keyHint) {
    const keyEl = document.createElement('span');
    keyEl.className = 'hotbar-key';
    keyEl.textContent = keyHint;
    slotEl.appendChild(keyEl);
  }

  if (!stack || stack.count <= 0) {
    slotEl.removeAttribute('title');
    return;
  }

  const def = ITEMS[stack.id];
  slotEl.title = def.nutrition ? `${def.name} · Restores ${def.nutrition} hunger` : def.name;

  const img = document.createElement('img');
  img.className = 'slot-icon';
  img.src = atlas.getItemIconDataUrl(stack.id);
  img.alt = def.name;
  img.draggable = false;
  slotEl.appendChild(img);

  if (stack.count > 1) {
    const countEl = document.createElement('span');
    countEl.className = 'slot-count';
    countEl.textContent = String(stack.count);
    slotEl.appendChild(countEl);
  }

  if (def.maxDurability !== undefined && stack.durability !== undefined && stack.durability < def.maxDurability) {
    const ratio = Math.max(0, Math.min(1, stack.durability / def.maxDurability));
    const barBg = document.createElement('div');
    barBg.className = 'slot-durability-bg';

    const barFill = document.createElement('div');
    barFill.className = 'slot-durability-fill';
    barFill.style.width = `${Math.round(ratio * 100)}%`;
    barFill.style.background =
      ratio > 0.5 ? '#4ade80' : ratio > 0.22 ? '#facc15' : '#ef4444';

    barBg.appendChild(barFill);
    slotEl.appendChild(barBg);
  }
}
