export class MajorityVoteSmoother {
  private window: string[] = [];
  constructor(private size = 7) {}

  push(label: string) {
    this.window.push(label);
    if (this.window.length > this.size) this.window.shift();
  }

  reset() {
    this.window = [];
  }

  getStableLabel(): string {
    if (this.window.length === 0) return "?";
    const counts = new Map<string, number>();
    for (const l of this.window) counts.set(l, (counts.get(l) || 0) + 1);

    let best = "?";
    let bestCount = 0;
    for (const [k, v] of counts.entries()) {
      if (v > bestCount) {
        best = k;
        bestCount = v;
      }
    }
    return best;
  }
}
