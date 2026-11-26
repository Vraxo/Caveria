import { matchCraftingGrid } from '../items/Crafting';
import { HOTBAR_SIZE, Inventory, TOTAL_INVENTORY_SLOTS } from '../items/Inventory';
import { ArmorSlot, ITEMS, ItemStack } from '../items/Item';
import { ARMOR_SLOTS, MAX_ARMOR_POINTS, ArmorManager } from '../player/ArmorManager';
import { TextureAtlas } from '../rendering/TextureAtlas';
import { renderItemStackIntoSlot } from './Hotbar';

export class InventoryModal {
  public isOpen = false;

  private readonly inventory: Inventory;
  private readonly atlas: TextureAtlas;
  private readonly modalEl: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly craftGridEl: HTMLElement;
  private readonly craftOutputEl: HTMLElement;
  private readonly armorGridEl: HTMLElement;
  private readonly armorBonusEl: HTMLElement;
  private readonly backpackGridEl: HTMLElement;
  private readonly hotbarGridEl: HTMLElement;
  private readonly cursorEl: HTMLElement;
  private readonly recipeHintEl: HTMLElement;

  private gridSize: 2 | 3 = 2;
  private craftSlots: Array<ItemStack | null> = new Array(9).fill(null);
  private cursorStack: ItemStack | null = null;
  private onDropOverflow?: (stack: ItemStack) => void;
  private onRequestClose?: () => void;

  constructor(
    inventory: Inventory,
    atlas: TextureAtlas,
    private readonly armor: ArmorManager,
    onDropOverflow: (stack: ItemStack) => void,
    onRequestClose: () => void
  ) {
    this.inventory = inventory;
    this.atlas = atlas;
    this.onDropOverflow = onDropOverflow;
    this.onRequestClose = onRequestClose;

    this.modalEl = document.getElementById('inventory-modal')!;
    this.titleEl = document.getElementById('craft-section-title')!;
    this.craftGridEl = document.getElementById('craft-grid')!;
    this.craftOutputEl = document.getElementById('craft-output-slot')!;
    this.armorGridEl = document.getElementById('armor-equipment-grid')!;
    this.armorBonusEl = document.getElementById('armor-bonus-label')!;
    this.backpackGridEl = document.getElementById('inv-backpack-grid')!;
    this.hotbarGridEl = document.getElementById('inv-hotbar-grid')!;
    this.cursorEl = document.getElementById('cursor-item')!;
    this.recipeHintEl = document.getElementById('recipe-book-hint')!;

    this.setupEvents();
    this.inventory.onChange(() => {
      if (this.isOpen) this.renderAll();
    });
  }

  public open(gridSize: 2 | 3): void {
    this.gridSize = gridSize;
    this.isOpen = true;
    this.craftSlots = new Array(gridSize * gridSize).fill(null);
    this.modalEl.classList.remove('hidden');
    this.titleEl.textContent =
      gridSize === 3 ? 'Crafting Table (3×3)' : 'Hand Crafting (2×2)';
    this.recipeHintEl.textContent =
      gridSize === 3
        ? 'Recipes: 3 Woven Fiber over 3 Planks → Bed · Gold Ingots or Chitin in classic equipment shapes → Gear · 8 Cobblestone around an empty center → Furnace'
        : 'Recipes: 4 Cave Vines → 4 Woven Fiber · 1 Log → 4 Planks · 4 Planks → Crafting Table (place & Right-Click for 3×3 equipment!)';

    this.renderAll();
  }

  public close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.modalEl.classList.add('hidden');
    this.cursorEl.classList.add('hidden');

    // Return any items left on cursor or in crafting grid to inventory (or drop in world if full)
    if (this.cursorStack && this.cursorStack.count > 0) {
      this.returnOrDrop(this.cursorStack);
      this.cursorStack = null;
    }

    for (let i = 0; i < this.craftSlots.length; i++) {
      const s = this.craftSlots[i];
      if (s && s.count > 0) {
        this.returnOrDrop(s);
        this.craftSlots[i] = null;
      }
    }
    this.inventory.notify();
  }

  private returnOrDrop(stack: ItemStack): void {
    this.inventory.addItem(stack);
    if (stack.count > 0) {
      this.onDropOverflow?.({ ...stack });
    }
  }

  private setupEvents(): void {
    window.addEventListener('mousemove', (e) => {
      if (!this.isOpen) return;
      this.cursorEl.style.left = `${e.clientX}px`;
      this.cursorEl.style.top = `${e.clientY}px`;
    });

    const closeBtn = document.getElementById('inv-close-btn');
    closeBtn?.addEventListener('click', () => {
      this.onRequestClose?.();
    });

    this.craftOutputEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.handleCraftOutputClick(e.shiftKey);
    });
  }

  private renderAll(): void {
    // 1. Crafting input grid
    this.craftGridEl.style.gridTemplateColumns = `repeat(${this.gridSize}, 48px)`;
    this.craftGridEl.innerHTML = '';
    for (let i = 0; i < this.craftSlots.length; i++) {
      const slotEl = document.createElement('div');
      slotEl.className = 'inv-slot';
      renderItemStackIntoSlot(slotEl, this.craftSlots[i], this.atlas);
      slotEl.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.handleSlotClick(
          () => this.craftSlots[i],
          (val) => {
            this.craftSlots[i] = val;
          },
          e.button,
          e.shiftKey,
          'craft'
        );
      });
      this.craftGridEl.appendChild(slotEl);
    }

    // 2. Crafting output preview
    const matched = matchCraftingGrid(this.craftSlots, this.gridSize);
    renderItemStackIntoSlot(this.craftOutputEl, matched, this.atlas);
    this.craftOutputEl.classList.toggle('craft-ready', matched !== null);

    // 3. Equipped armor
    this.renderArmorSlots();

    // 4. Main backpack (slots 9..35)
    this.backpackGridEl.innerHTML = '';
    for (let i = HOTBAR_SIZE; i < TOTAL_INVENTORY_SLOTS; i++) {
      const slotEl = document.createElement('div');
      slotEl.className = 'inv-slot';
      renderItemStackIntoSlot(slotEl, this.inventory.getSlot(i), this.atlas);
      slotEl.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.handleSlotClick(
          () => this.inventory.getSlot(i),
          (val) => this.inventory.setSlot(i, val),
          e.button,
          e.shiftKey,
          'backpack',
          i
        );
      });
      this.backpackGridEl.appendChild(slotEl);
    }

    // 5. Hotbar row (slots 0..8)
    this.hotbarGridEl.innerHTML = '';
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slotEl = document.createElement('div');
      slotEl.className = 'inv-slot';
      renderItemStackIntoSlot(slotEl, this.inventory.getSlot(i), this.atlas, String(i + 1));
      slotEl.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.handleSlotClick(
          () => this.inventory.getSlot(i),
          (val) => this.inventory.setSlot(i, val),
          e.button,
          e.shiftKey,
          'hotbar',
          i
        );
      });
      this.hotbarGridEl.appendChild(slotEl);
    }

    // 6. Floating cursor stack
    if (this.cursorStack && this.cursorStack.count > 0) {
      this.cursorEl.classList.remove('hidden');
      renderItemStackIntoSlot(this.cursorEl, this.cursorStack, this.atlas);
    } else {
      this.cursorEl.classList.add('hidden');
    }
  }

  private renderArmorSlots(): void {
    this.armorGridEl.innerHTML = '';
    this.armorBonusEl.textContent = this.armor.hasFullChitinSet
      ? 'Full Chitin set: 45% less Crawler knockback'
      : this.armor.hasFullGoldSet
        ? 'Full Gold set: cold-weather resistance'
        : `${this.armor.armorPoints}/${MAX_ARMOR_POINTS} protection`;
    for (const slot of ARMOR_SLOTS) {
      const wrapper = document.createElement('div');
      wrapper.className = 'armor-slot-wrap';
      const slotEl = document.createElement('div');
      slotEl.className = 'inv-slot';
      const equipped = this.armor.get(slot);
      slotEl.classList.toggle('armor-slot-equipped', equipped !== null);
      renderItemStackIntoSlot(slotEl, equipped, this.atlas);
      if (!equipped) slotEl.title = `Equip ${slot}`;
      slotEl.addEventListener('mousedown', (event) => {
        event.preventDefault();
        this.handleArmorSlot(slot, event.button, event.shiftKey);
      });
      const label = document.createElement('span');
      label.className = 'armor-slot-label';
      label.textContent = slot === 'chestplate' ? 'Chest' : slot;
      wrapper.append(slotEl, label);
      this.armorGridEl.appendChild(wrapper);
    }
  }

  private handleArmorSlot(slot: ArmorSlot, mouseButton: number, shiftKey: boolean): void {
    const target = this.armor.get(slot);
    if (shiftKey && target) {
      const remainder = { ...target };
      this.inventory.addItem(remainder);
      if (remainder.count <= 0) this.armor.set(slot, null, false);
      this.renderAll();
      return;
    }
    if (mouseButton !== 0 && mouseButton !== 2) return;

    if (!this.cursorStack) {
      if (!target) return;
      this.cursorStack = target;
      this.armor.set(slot, null, false);
    } else if (ITEMS[this.cursorStack.id].armorSlot === slot) {
      const incoming = this.cursorStack;
      this.cursorStack = target;
      this.armor.set(slot, incoming);
    }
    this.renderAll();
  }

  private handleSlotClick(
    getTarget: () => ItemStack | null,
    setTarget: (val: ItemStack | null) => void,
    mouseButton: number,
    shiftKey: boolean,
    section: 'craft' | 'backpack' | 'hotbar',
    invIndex?: number
  ): void {
    const target = getTarget();

    // Shift-click quick-transfer between hotbar <-> backpack or craft -> inventory
    if (shiftKey && target) {
      const armorSlot = ITEMS[target.id].armorSlot;
      if (section !== 'craft' && armorSlot) {
        const displaced = this.armor.quickEquip(target);
        setTarget(displaced ?? null);
      } else if (section === 'craft') {
        const clone = { ...target };
        this.inventory.addItem(clone);
        setTarget(clone.count > 0 ? clone : null);
      } else if (section === 'backpack' && invIndex !== undefined) {
        this.quickMoveRange(invIndex, 0, HOTBAR_SIZE);
      } else if (section === 'hotbar' && invIndex !== undefined) {
        this.quickMoveRange(invIndex, HOTBAR_SIZE, TOTAL_INVENTORY_SLOTS);
      }
      this.renderAll();
      return;
    }

    // Left click: pick up, place all, merge, or swap
    if (mouseButton === 0) {
      if (!this.cursorStack) {
        if (!target) return;
        this.cursorStack = target;
        setTarget(null);
      } else if (!target) {
        setTarget(this.cursorStack);
        this.cursorStack = null;
      } else if (
        target.id === this.cursorStack.id &&
        ITEMS[target.id].maxStack > 1 &&
        target.count < ITEMS[target.id].maxStack
      ) {
        const maxStack = ITEMS[target.id].maxStack;
        const space = maxStack - target.count;
        const move = Math.min(space, this.cursorStack.count);
        target.count += move;
        this.cursorStack.count -= move;
        if (this.cursorStack.count <= 0) this.cursorStack = null;
        setTarget(target);
      } else {
        // Swap
        const prev = target;
        setTarget(this.cursorStack);
        this.cursorStack = prev;
      }
    } else if (mouseButton === 2) {
      // Right click: split half if cursor empty, or place 1 item if holding stack
      if (!this.cursorStack && target) {
        const take = Math.ceil(target.count / 2);
        this.cursorStack = { ...target, count: take };
        target.count -= take;
        setTarget(target.count > 0 ? target : null);
      } else if (this.cursorStack) {
        if (!target) {
          setTarget({
            id: this.cursorStack.id,
            count: 1,
            durability: this.cursorStack.durability,
          });
          this.cursorStack.count -= 1;
          if (this.cursorStack.count <= 0) this.cursorStack = null;
        } else if (
          target.id === this.cursorStack.id &&
          ITEMS[target.id].maxStack > 1 &&
          target.count < ITEMS[target.id].maxStack
        ) {
          target.count += 1;
          this.cursorStack.count -= 1;
          if (this.cursorStack.count <= 0) this.cursorStack = null;
          setTarget(target);
        }
      }
    }

    this.renderAll();
  }

  private handleCraftOutputClick(shiftAll: boolean): void {
    const craftOnce = (): boolean => {
      const output = matchCraftingGrid(this.craftSlots, this.gridSize);
      if (!output) return false;
      const def = ITEMS[output.id];

      if (shiftAll) {
        const clone = { ...output };
        this.inventory.addItem(clone);
        if (clone.count > 0) return false; // Inventory couldn't fit output
      } else {
        if (!this.cursorStack) {
          this.cursorStack = { ...output };
        } else if (
          this.cursorStack.id === output.id &&
          def.maxStack > 1 &&
          this.cursorStack.count + output.count <= def.maxStack
        ) {
          this.cursorStack.count += output.count;
        } else {
          return false;
        }
      }

      // Consume 1 ingredient from every occupied crafting cell
      for (let i = 0; i < this.craftSlots.length; i++) {
        const s = this.craftSlots[i];
        if (s) {
          s.count -= 1;
          if (s.count <= 0) this.craftSlots[i] = null;
        }
      }
      return true;
    };

    if (shiftAll) {
      let safety = 64;
      while (safety-- > 0 && craftOnce()) {
        // craft until ingredients run out or inventory fills
      }
    } else {
      craftOnce();
    }

    this.inventory.notify();
    this.renderAll();
  }

  private quickMoveRange(fromIdx: number, destStart: number, destEnd: number): void {
    const stack = this.inventory.getSlot(fromIdx);
    if (!stack) return;
    const def = ITEMS[stack.id];

    // Merge into matching stacks first
    if (def.maxStack > 1) {
      for (let i = destStart; i < destEnd && stack.count > 0; i++) {
        const dest = this.inventory.getSlot(i);
        if (dest && dest.id === stack.id && dest.count < def.maxStack) {
          const move = Math.min(def.maxStack - dest.count, stack.count);
          dest.count += move;
          stack.count -= move;
        }
      }
    }

    // Then empty slots
    for (let i = destStart; i < destEnd && stack.count > 0; i++) {
      if (!this.inventory.getSlot(i)) {
        this.inventory.setSlot(i, { ...stack });
        stack.count = 0;
      }
    }

    this.inventory.setSlot(fromIdx, stack.count > 0 ? stack : null);
  }
}
