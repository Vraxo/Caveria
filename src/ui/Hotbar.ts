import { Input } from '../core/Input';
import { TextureAtlas } from '../rendering/TextureAtlas';
import { BLOCKS, BlockId, HOTBAR_BLOCKS } from '../world/Block';

export class Hotbar {
  private readonly slots: BlockId[];
  private readonly slotEls: HTMLElement[] = [];
  private readonly containerEl: HTMLElement;
  private readonly labelEl: HTMLElement;
  private readonly atlas: TextureAtlas;
  private selectedIndex = 0;

  constructor(atlas: TextureAtlas) {
    this.atlas = atlas;
    this.slots = [...HOTBAR_BLOCKS];
    this.containerEl = document.getElementById('hotbar')!;
    this.labelEl = document.getElementById('selected-block-label')!;

    this.renderSlots();
    this.selectIndex(0);
  }

  public get selectedBlock(): BlockId {
    return this.slots[this.selectedIndex];
  }

  public update(input: Input): void {
    for (let i = 0; i < 9; i++) {
      if (input.consumeKeyPress(`Digit${i + 1}`)) {
        this.selectIndex(i);
      }
    }

    if (input.wheelDelta !== 0) {
      const next = ((this.selectedIndex + Math.sign(input.wheelDelta)) % this.slots.length + this.slots.length) % this.slots.length;
      this.selectIndex(next);
    }
  }

  /** Middle-click pick-block helper */
  public pickBlock(blockId: BlockId): void {
    if (blockId === BlockId.Air || blockId === BlockId.Water || blockId === BlockId.Bedrock) {
      return;
    }
    const existing = this.slots.indexOf(blockId);
    if (existing !== -1) {
      this.selectIndex(existing);
      return;
    }

    // Replace active slot with picked block
    this.slots[this.selectedIndex] = blockId;
    const slotEl = this.slotEls[this.selectedIndex];
    const oldCanvas = slotEl.querySelector('canvas');
    if (oldCanvas) oldCanvas.remove();
    slotEl.appendChild(this.atlas.createBlockIcon(blockId));
    this.selectIndex(this.selectedIndex);
  }

  private renderSlots(): void {
    this.containerEl.innerHTML = '';
    this.slotEls.length = 0;

    for (let i = 0; i < this.slots.length; i++) {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot';

      const keyLabel = document.createElement('span');
      keyLabel.className = 'hotbar-key';
      keyLabel.textContent = String(i + 1);
      slot.appendChild(keyLabel);

      const icon = this.atlas.createBlockIcon(this.slots[i]);
      slot.appendChild(icon);

      this.containerEl.appendChild(slot);
      this.slotEls.push(slot);
    }
  }

  private selectIndex(idx: number): void {
    this.selectedIndex = idx;
    for (let i = 0; i < this.slotEls.length; i++) {
      this.slotEls[i].classList.toggle('active', i === idx);
    }
    const def = BLOCKS[this.selectedBlock];
    this.labelEl.textContent = def.name;
  }
}
