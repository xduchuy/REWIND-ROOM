import { rooms, type Point, type Room } from "../levels/rooms";
export const RATE = 30,
  LIMIT = 1800,
  SPEED = 3;
export type Outcome = "active" | "failed" | "won";
export interface Actor extends Point {
  facing: number;
  moving: boolean;
}
export interface Snapshot {
  tick: number;
  player: Actor;
  plates: boolean[];
  door: boolean;
  switchOn: boolean;
  switchUntil: number;
  core: boolean;
  platform: number;
  platformPhase: number;
  hazardPhase: number;
  outcome: Outcome;
  reason: string;
  events: number[];
}
export interface Echo {
  frames: Actor[];
  duration: number;
}
export interface Input {
  x: number;
  z: number;
  interact?: boolean;
}
const clone = (s: Snapshot): Snapshot => ({
  ...s,
  player: { ...s.player },
  plates: [...s.plates],
  events: [...s.events],
});
export class Simulation {
  room: Room;
  state!: Snapshot;
  history: Snapshot[] = [];
  echoes: Echo[] = [];
  rewinding = false;
  constructor(id = 0) {
    this.room = rooms[id];
    this.retry();
  }
  retry() {
    this.state = {
      tick: 0,
      player: { x: 0, z: 3.8, facing: Math.PI, moving: false },
      plates: this.room.plates.map(() => false),
      door: false,
      switchOn: false,
      switchUntil: 0,
      core: false,
      platform: 0.6,
      platformPhase: 0,
      hazardPhase: 0,
      outcome: "active",
      reason: "",
      events: [],
    };
    this.history = [clone(this.state)];
    this.rewinding = false;
  }
  reset() {
    this.echoes = [];
    this.retry();
  }
  echoAt(e: Echo, tick = this.state.tick): Actor | undefined {
    return tick <= e.duration ? e.frames[tick] : undefined;
  }
  commit(replace?: number): boolean {
    if (this.state.tick < 1) return false;
    if (
      this.echoes.length === 2 &&
      (replace === undefined || replace < 0 || replace > 1)
    )
      return false;
    const e: Echo = {
      duration: this.state.tick,
      frames: this.history
        .slice(0, this.state.tick + 1)
        .map((s) => ({ ...s.player })),
    };
    if (this.echoes.length < 2) this.echoes.push(e);
    else this.echoes[replace!] = e;
    this.retry();
    return true;
  }
  seek(tick: number) {
    this.rewinding = true;
    this.state = clone(
      this.history[
        Math.max(0, Math.min(Math.floor(tick), this.history.length - 1))
      ],
    );
  }
  resume() {
    this.history.length = this.state.tick + 1;
    this.rewinding = false;
  }
  context(): string {
    const p = this.state.player;
    if (this.room.core && !this.state.core && distance(p, this.room.core) < 1.2)
      return "E · Collect energy core";
    if (this.room.console && distance(p, this.room.console) < 1.2)
      return this.room.id === 4 && !this.state.core
        ? "Find the energy core first"
        : "E · Activate power console";
    return "";
  }
  private blocked(x: number, z: number) {
    if (Math.abs(x) > 5.7 || Math.abs(z) > 4.7) return true;
    for (const w of this.room.walls)
      if (
        Math.abs(x - w.x) < w.w / 2 + 0.23 &&
        Math.abs(z - w.z) < w.d / 2 + 0.23
      )
        return true;
    const gateZ = this.room.gap ? -3 : -2;
    if (!this.state.door && Math.abs(z - gateZ) < 0.4 && Math.abs(x) < 1.23)
      return true;
    if (
      this.room.gap &&
      z < 0.3 &&
      z > -2.3 &&
      !(Math.abs(x) < 0.8 && Math.abs(z - this.state.platform) < 0.65)
    )
      return true;
    return false;
  }
  step(input: Input = { x: 0, z: 0 }) {
    const s = this.state;
    if (this.rewinding || s.outcome !== "active") return;
    s.tick++;
    const prev = s.platform;
    // Power advances a local phase: changing occupancy must never teleport the ferry.
    if (this.room.gap && s.plates[0]) {
      s.platformPhase = (s.platformPhase + 1) % 180;
      s.platform = 0.6 - 3.2 * (0.5 - 0.5 * Math.cos((s.platformPhase / 180) * Math.PI * 2));
    }
    if (
      this.room.gap &&
      Math.abs(s.player.x) < 0.8 &&
      Math.abs(s.player.z - prev) < 0.66 &&
      s.player.z < 0.4 &&
      s.player.z > -2.4
    )
      s.player.z += s.platform - prev;
    const len = Math.hypot(input.x, input.z),
      dx = len ? ((input.x / len) * SPEED) / RATE : 0,
      dz = len ? ((input.z / len) * SPEED) / RATE : 0;
    if (!this.blocked(s.player.x + dx, s.player.z)) s.player.x += dx;
    if (!this.blocked(s.player.x, s.player.z + dz)) s.player.z += dz;
    s.player.moving = len > 0;
    if (len) s.player.facing = Math.atan2(dx, dz);
    if (input.interact) {
      let changed = false;
      if (
        this.room.core &&
        !s.core &&
        distance(s.player, this.room.core) < 1.2
      ) {
        s.core = true;
        changed = true;
      } else if (
        this.room.console &&
        distance(s.player, this.room.console) < 1.2 &&
        (this.room.id !== 4 || s.core)
      ) {
        s.switchOn = true;
        s.switchUntil = s.tick + 360;
        changed = true;
      }
      if (changed) s.events.push(s.tick);
    }
    s.plates = this.room.plates.map(
      (p) =>
        distance(p, s.player) < 0.65 ||
        this.echoes.some((e) => {
          const a = this.echoAt(e);
          return a !== undefined && distance(a, p) < 0.65;
        }),
    );
    if (this.room.id === 0) {
      s.switchOn = s.tick < s.switchUntil;
      s.door = s.switchOn;
    } else
      s.door =
        s.plates.every(Boolean) &&
        (this.room.id !== 4 || (s.core && s.switchOn));
    s.hazardPhase = s.tick % 120;
    const hazardZ = this.room.gap ? -3.65 : -1.2;
    if (
      this.room.hazard &&
      s.hazardPhase < 45 &&
      Math.abs(s.player.z - hazardZ) < 0.19
    ) {
      s.outcome = "failed";
      s.reason = "The scanner caught this timeline.";
    }
    if (
      s.outcome === "active" &&
      s.door &&
      s.player.z < -4.05 &&
      Math.abs(s.player.x) < 0.9
    )
      s.outcome = "won";
    if (s.outcome === "active" && s.tick >= LIMIT) {
      s.outcome = "failed";
      s.reason = "The 60-second cycle has ended.";
    }
    this.history[s.tick] = clone(s);
  }
}
export function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
