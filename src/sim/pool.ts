/**
 * Fixed-capacity entity pool. API-compatible with the shell's EntityPool, but acquire()
 * resumes scanning from the last acquired slot, so bursts of spawns cost O(1) amortized
 * instead of rescanning the pool from slot 0. Items are released by setting `active = false`.
 */
export class Pool<T extends { active: boolean }> {
  readonly items: T[];
  private cursor = 0;
  constructor(capacity: number, factory: () => T) {
    this.items = Array.from({ length: capacity }, factory);
  }
  acquire(): T | undefined {
    const items = this.items,
      n = items.length;
    for (let k = 0; k < n; k++) {
      const i = this.cursor + k < n ? this.cursor + k : this.cursor + k - n;
      const item = items[i];
      if (!item.active) {
        item.active = true;
        this.cursor = i + 1 < n ? i + 1 : 0;
        return item;
      }
    }
    return undefined;
  }
  clear() {
    for (const item of this.items) item.active = false;
    this.cursor = 0;
  }
  get count() {
    let n = 0;
    for (const item of this.items) if (item.active) n++;
    return n;
  }
}
