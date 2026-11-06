export class FixedStepLoop {
  private accumulator = 0;
  advance(seconds: number, active: boolean, step: () => void) {
    if (!active) {
      this.accumulator = 0;
      return;
    }
    this.accumulator += Math.min(seconds, 0.25);
    while (this.accumulator + 1e-10 >= 1 / 30) {
      step();
      this.accumulator -= 1 / 30;
    }
  }
  reset() {
    this.accumulator = 0;
  }
}
