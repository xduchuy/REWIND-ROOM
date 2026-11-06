export interface Point {
  x: number;
  z: number;
}
export interface Rect extends Point {
  w: number;
  d: number;
}
export interface Room {
  id: number;
  title: string;
  subtitle: string;
  plates: Point[];
  console?: Point;
  core?: Point;
  walls: Rect[];
  hints: string[];
  gap: boolean;
  hazard: boolean;
}
const barrier: Rect[] = [
  { x: -3.5, z: -2, w: 5, d: 0.3 },
  { x: 3.5, z: -2, w: 5, d: 0.3 },
];
export const rooms: Room[] = [
  {
    id: 0,
    title: "The first correction",
    subtitle: "Every mistake is a place to begin again.",
    plates: [],
    console: { x: -2, z: 2 },
    walls: [...barrier, { x: 3, z: 0.3, w: 2, d: 0.5 }],
    gap: false,
    hazard: false,
    hints: [
      "Approach the amber console and press E. It opens the gate for 12 seconds.",
      "Walk through the central gate to the illuminated exit. WASD follows the room axes.",
      "Missed the window? Hold R or drag the timeline backward, then choose a better path.",
    ],
  },
  {
    id: 1,
    title: "Hold the line",
    subtitle: "Leave someone behind. Let it be you.",
    plates: [{ x: -3, z: 1 }],
    walls: [...barrier, { x: 2.8, z: 2, w: 0.5, d: 2 }],
    gap: false,
    hazard: false,
    hints: [
      "Stand on the cyan plate at the left. Stay there until the clock reads about 35, then press F.",
      "Your Echo repeats that entire route, including the time you spent waiting.",
      "In the next loop, take the central gate while your Echo holds the plate. An Echo vanishes when its recording ends.",
    ],
  },
  {
    id: 2,
    title: "Split seconds",
    subtitle: "Two histories. One way forward.",
    plates: [
      { x: -3, z: 1 },
      { x: 3, z: 1 },
    ],
    walls: [...barrier, { x: 0, z: 1.5, w: 1.3, d: 1.5 }],
    gap: false,
    hazard: false,
    hints: [
      "Record a 25-second loop ending on the left plate. Wait on the plate before committing.",
      "Record a second 25-second loop ending on the right plate. Both Echoes must overlap.",
      "With both plates occupied, take the central passage and walk into the exit.",
    ],
  },
  {
    id: 3,
    title: "The moving window",
    subtitle: "Time will carry you, if you let it.",
    plates: [{ x: -3, z: 2 }],
    walls: [
      { x: -3.5, z: -3, w: 5, d: 0.3 },
      { x: 3.5, z: -3, w: 5, d: 0.3 },
    ],
    gap: true,
    hazard: true,
    hints: [
      "Record 35 seconds with an Echo waiting on the plate. It powers the ferry.",
      "At the center of the near edge, board the brass platform when it arrives. Release movement to ride it across.",
      "The coral scanner crosses the far landing. Cross its line while it is dim. Rewind a collision to try a different timing.",
    ],
  },
  {
    id: 4,
    title: "The paradox engine",
    subtitle: "You were never here alone.",
    plates: [
      { x: -3, z: 1 },
      { x: 3, z: 1 },
    ],
    console: { x: 0, z: -0.4 },
    core: { x: 3, z: 3.2 },
    walls: [
      ...barrier,
      { x: -4.8, z: 2.7, w: 0.5, d: 1.8 },
      { x: 4.8, z: 0, w: 0.5, d: 1.8 },
    ],
    gap: false,
    hazard: true,
    hints: [
      "Make two 35-second recordings: one waiting on each plate.",
      "On your final loop, collect the energy core on the right with E. Bring it to the central console and press E.",
      "Both Echoes, the core, and the console power the gate. Cross the coral scanner when dim, then reach the exit.",
    ],
  },
];
