export class MajorityVoteSmoother {
  private window: string[] = [];
  constructor(private windowSize = 5) {}

  push(label: string) {
    this.window.push(label);
    if (this.window.length > this.windowSize) this.window.shift();
  }

  getStableLabel() {
    if (this.window.length === 0) return "Ready";

    const counts = new Map<string, number>();
    for (const l of this.window) counts.set(l, (counts.get(l) ?? 0) + 1);

    let best = this.window[this.window.length - 1];
    let bestCount = 0;

    for (const [label, count] of counts.entries()) {
      if (count > bestCount) {
        best = label;
        bestCount = count;
      }
    }
    return best;
  }
}
