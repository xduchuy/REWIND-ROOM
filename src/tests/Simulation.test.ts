import { describe, it, expect } from "vitest";
import { Simulation, LIMIT } from "../core/Simulation";
import { FixedStepLoop } from "../core/FixedStepLoop";
function wait(s: Simulation, n: number) {
  for (let i = 0; i < n; i++) s.step();
}
function go(s: Simulation, x: number, z: number) {
  for (
    let i = 0;
    i < 600 && Math.hypot(x - s.state.player.x, z - s.state.player.z) > 0.09;
    i++
  ) {
    if (s.state.outcome === "won") return;
    if (s.state.outcome !== "active")
      throw Error(
        `room ${s.room.id}: ${s.state.reason} at ${s.state.player.x},${s.state.player.z}`,
      );
    s.step({
      x:
        Math.abs(x - s.state.player.x) > 0.06
          ? Math.sign(x - s.state.player.x)
          : 0,
      z:
        Math.abs(z - s.state.player.z) > 0.06
          ? Math.sign(z - s.state.player.z)
          : 0,
    });
  }
  expect(Math.hypot(x - s.state.player.x, z - s.state.player.z)).toBeLessThan(
    0.12,
  );
}
function record(s: Simulation, index: number, duration = 1050) {
  const p = s.room.plates[index];
  go(s, p.x, 3.8);
  go(s, p.x, p.z);
  wait(s, duration - s.state.tick);
  expect(s.commit()).toBe(true);
}
function scanner(s: Simulation) {
  while (s.state.tick % 120 < 50 || s.state.tick % 120 > 80) s.step();
}
export function solve(id: number) {
  const s = new Simulation(id);
  if (id === 0) {
    go(s, -2, 2);
    s.step({ x: 0, z: 0, interact: true });
    go(s, 0, 2);
    go(s, 0, -4.3);
  }
  if (id === 1) {
    record(s, 0);
    go(s, 0, -4.3);
  }
  if (id === 2) {
    record(s, 0);
    record(s, 1);
    go(s, 2, 3.8);
    go(s, 2, -0.7);
    go(s, 0, -0.7);
    go(s, 0, -4.3);
  }
  if (id === 3) {
    record(s, 0);
    go(s, 0, -3.2);
    scanner(s);
    go(s, 0, -4.3);
  }
  if (id === 4) {
    record(s, 0);
    record(s, 1);
    go(s, 3, 3.2);
    s.step({ x: 0, z: 0, interact: true });
    go(s, 0, 3.2);
    go(s, 0, -0.4);
    s.step({ x: 0, z: 0, interact: true });
    go(s, 0, -0.8);
    scanner(s);
    go(s, 0, -4.3);
  }
  return s;
}
describe("verified complete room solutions", () => {
  for (let id = 0; id < 5; id++)
    it(`R-0${id} can be solved within 60 seconds using at most two echoes`, () => {
      const s = solve(id);
      expect(s.state.outcome).toBe("won");
      expect(s.state.tick).toBeLessThan(LIMIT);
      expect(s.echoes.length).toBeLessThanOrEqual(2);
    });
});
describe("clock and scheduling", () => {
  it("fails at exactly 1800 ticks", () => {
    const s = new Simulation();
    wait(s, 1799);
    expect(s.state.outcome).toBe("active");
    s.step();
    expect(s.state.tick).toBe(1800);
    expect(s.state.outcome).toBe("failed");
    s.step();
    expect(s.state.tick).toBe(1800);
  });
  it("pause cannot advance and rendering cadence does not alter the simulation", () => {
    for (const fps of [20, 30, 60, 144]) {
      const s = new Simulation(),
        l = new FixedStepLoop();
      for (let i = 0; i < fps * 10; i++)
        l.advance(1 / fps, true, () => s.step());
      expect(s.state.tick).toBe(300);
      l.advance(1, false, () => s.step());
      expect(s.state.tick).toBe(300);
    }
  });
});
describe("rewind and branching", () => {
  it("restores all state fields exactly and removes the abandoned future", () => {
    const s = solve(4);
    const tick = 80,
      snapshot = structuredClone(s.history[tick]);
    s.seek(tick);
    expect(s.state).toEqual(snapshot);
    s.step({ x: 1, z: 1, interact: true });
    expect(s.state).toEqual(snapshot);
    s.resume();
    expect(s.history.length).toBe(tick + 1);
    s.step({ x: -1, z: 0 });
    expect(s.history.length).toBe(tick + 2);
    s.seek(0);
    expect(s.state.tick).toBe(0);
    expect(s.state.core).toBe(false);
    expect(s.state.switchOn).toBe(false);
    expect(s.state.player).toEqual(s.history[0].player);
  });
  it("restores timed switches and doors", () => {
    const s = new Simulation();
    go(s, -2, 2);
    s.step({ x: 0, z: 0, interact: true });
    const t = s.state.tick;
    expect(s.state.door).toBe(true);
    wait(s, 361);
    expect(s.state.door).toBe(false);
    s.seek(t);
    expect(s.state.door).toBe(true);
    expect(s.state.switchOn).toBe(true);
    s.seek(t - 1);
    expect(s.state.switchOn).toBe(false);
  });
  it("restores platform and hazard phases", () => {
    const s = new Simulation(3);
    record(s, 0);
    wait(s, 180);
    const snap = structuredClone(s.state);
    wait(s, 44);
    s.seek(180);
    expect(s.state).toEqual(snap);
  });
});
describe("recorded echoes", () => {
  it("starts at tick zero, replays plate occupancy, and expires", () => {
    const s = new Simulation(1);
    record(s, 0, 150);
    expect(s.echoes[0].frames[0].z).toBe(3.8);
    wait(s, 140);
    expect(s.state.plates[0]).toBe(true);
    expect(s.echoAt(s.echoes[0])).toEqual(s.echoes[0].frames[140]);
    wait(s, 11);
    expect(s.state.plates[0]).toBe(false);
    expect(s.echoAt(s.echoes[0])).toBeUndefined();
    s.seek(140);
    expect(s.echoAt(s.echoes[0])).toEqual(s.echoes[0].frames[140]);
    expect(s.state.plates[0]).toBe(true);
  });
  it("requires replacement choice and resets stale effects", () => {
    const s = new Simulation(2);
    record(s, 0, 150);
    record(s, 1, 150);
    wait(s, 140);
    expect(s.state.door).toBe(true);
    expect(s.commit()).toBe(false);
    expect(s.commit(0)).toBe(true);
    expect(s.state.door).toBe(false);
    wait(s, 140);
    expect(s.state.plates[0]).toBe(false);
    s.retry();
    expect(s.echoes.length).toBe(2);
    s.reset();
    expect(s.echoes).toEqual([]);
    expect(s.state.tick).toBe(0);
  });
  it("does not replay direct interactions or pickups", () => {
    const s = new Simulation(4);
    go(s, 3, 3.2);
    s.step({ x: 0, z: 0, interact: true });
    expect(s.state.core).toBe(true);
    s.commit();
    wait(s, 100);
    expect(s.state.core).toBe(false);
    expect(s.state.switchOn).toBe(false);
  });
});
describe("collision and outcomes", () => {
  it("blocks closed gates, and invalid exits never win", () => {
    const s = new Simulation(1);
    for (let i = 0; i < 120; i++) s.step({ x: 0, z: -1 });
    expect(s.state.player.z).toBeGreaterThan(-1.7);
    expect(s.state.outcome).toBe("active");
    s.state.player = { x: 0, z: -4.4, facing: 0, moving: false };
    s.step();
    expect(s.state.outcome).toBe("active");
  });
  it("hazards fail and retry preserves recordings", () => {
    const s = new Simulation(4);
    record(s, 0);
    s.state.player.z = -1.2;
    s.step();
    expect(s.state.outcome).toBe("failed");
    s.retry();
    expect(s.state.outcome).toBe("active");
    expect(s.echoes.length).toBe(1);
  });
  it("side walls constrain movement", () => {
    const s = new Simulation();
    for (let i = 0; i < 400; i++) s.step({ x: 1, z: 0 });
    expect(s.state.player.x).toBeLessThanOrEqual(5.7);
  });
});
it('platform power changes preserve continuous motion and rewindable phase', () => {
  const s = new Simulation(3);
  wait(s, 80);
  s.state.player.x = -3;
  s.state.player.z = 2;
  s.step();
  const before = s.state.platform;
  s.step();
  expect(Math.abs(s.state.platform - before)).toBeLessThan(.06);
  const phase = s.state.platformPhase;
  const tick = s.state.tick;
  wait(s, 50);
  s.seek(tick);
  expect(s.state.platformPhase).toBe(phase);
});
