/**
 * Uniform-grid spatial index over fixed world bounds. rebuild() is a counting sort into flat
 * typed arrays; query() writes candidates into a caller-owned buffer and returns the count.
 * No per-frame or per-query allocation and no callbacks. Each call site owns its buffer, so
 * nested queries from different call sites never clobber each other.
 * Candidates are returned cell by cell (row-major), in insertion order within a cell.
 */
export class Grid<T extends { x: number; y: number }> {
  readonly cols: number;
  readonly rows: number;
  private readonly start: Int32Array;
  private readonly fill: Int32Array;
  private readonly cellOf: Int32Array;
  private sorted: T[] = [];
  private count = 0;
  constructor(
    width: number,
    height: number,
    readonly cellSize: number,
    capacity: number,
  ) {
    this.cols = Math.ceil(width / cellSize) + 1;
    this.rows = Math.ceil(height / cellSize) + 1;
    this.start = new Int32Array(this.cols * this.rows + 1);
    this.fill = new Int32Array(this.cols * this.rows);
    this.cellOf = new Int32Array(capacity);
    this.sorted = new Array<T>(capacity);
  }
  private cell(x: number, y: number) {
    let cx = Math.floor(x / this.cellSize),
      cy = Math.floor(y / this.cellSize);
    if (cx < 0) cx = 0;
    else if (cx >= this.cols) cx = this.cols - 1;
    if (cy < 0) cy = 0;
    else if (cy >= this.rows) cy = this.rows - 1;
    return cy * this.cols + cx;
  }
  /** Re-index every item for which `include` is true (all items when omitted). */
  rebuild(items: readonly T[], include?: (item: T) => boolean) {
    const start = this.start,
      fill = this.fill,
      cellOf = this.cellOf;
    start.fill(0);
    let n = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (include && !include(item)) {
        cellOf[i] = -1;
        continue;
      }
      const c = this.cell(item.x, item.y);
      cellOf[i] = c;
      start[c + 1]++;
      n++;
    }
    for (let c = 1; c < start.length; c++) start[c] += start[c - 1];
    fill.set(start.subarray(0, fill.length));
    for (let i = 0; i < items.length; i++) {
      const c = cellOf[i];
      if (c >= 0) this.sorted[fill[c]++] = items[i];
    }
    this.count = n;
  }
  /** Collect items in cells overlapping the square around (x, y). Returns the count written. */
  query(x: number, y: number, radius: number, out: T[]) {
    const size = this.cellSize;
    let minX = Math.floor((x - radius) / size),
      maxX = Math.floor((x + radius) / size),
      minY = Math.floor((y - radius) / size),
      maxY = Math.floor((y + radius) / size);
    if (maxX < 0 || maxY < 0 || minX >= this.cols || minY >= this.rows || this.count === 0)
      return 0;
    if (minX < 0) minX = 0;
    if (minY < 0) minY = 0;
    if (maxX >= this.cols) maxX = this.cols - 1;
    if (maxY >= this.rows) maxY = this.rows - 1;
    let n = 0;
    for (let cy = minY; cy <= maxY; cy++) {
      const row = cy * this.cols;
      for (let cx = minX; cx <= maxX; cx++) {
        const c = row + cx;
        for (let i = this.start[c], end = this.start[c + 1]; i < end; i++)
          out[n++] = this.sorted[i];
      }
    }
    return n;
  }
}
