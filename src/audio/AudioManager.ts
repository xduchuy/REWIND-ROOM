export class AudioManager {
  ctx?: AudioContext;
  master?: GainNode;
  effects = 0.5;
  volume = 0.5;
  start() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      const o = this.ctx.createOscillator(),
        g = this.ctx.createGain();
      o.type = "sine";
      o.frequency.value = 55;
      g.gain.value = 0.025;
      o.connect(g);
      g.connect(this.master);
      o.start();
    }
    void this.ctx.resume();
  }
  set(master: number, effects: number) {
    this.volume = master;
    this.effects = effects;
    if (this.master) this.master.gain.value = master;
  }
  tone(
    kind:
      | "tick"
      | "switch"
      | "door"
      | "plate"
      | "rewind"
      | "echo"
      | "fail"
      | "win",
  ) {
    if (!this.ctx || !this.master) return;
    const c = this.ctx,
      o = c.createOscillator(),
      g = c.createGain();
    const f = {
      tick: 600,
      switch: 320,
      door: 110,
      plate: 440,
      rewind: 220,
      echo: 660,
      fail: 90,
      win: 520,
    }[kind];
    o.type = kind === "fail" ? "triangle" : "sine";
    o.frequency.setValueAtTime(f, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      kind === "rewind" ? 55 : f * 1.5,
      c.currentTime + 0.3,
    );
    g.gain.setValueAtTime(
      (kind === "tick" ? 0.012 : 0.07) * this.effects,
      c.currentTime,
    );
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.4);
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.stop(c.currentTime + 0.42);
  }
}
