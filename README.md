# REWIND ROOM

A playable, procedural 3D puzzle game about cooperating with your past selves. Five chambers, sixty seconds per attempt, and two recorded temporal Echoes. Everything runs locally in the browser; there is no account, backend, CDN, or downloaded art.

## Run

Node.js 22 or newer (developed with Node 24). From this directory:

```sh
npm ci
npm run dev
```

Open the address printed by Vite. WebGL is required. Click **Begin experiment** to unlock audio and enter R–00. Progress and preferences save locally in this browser.

```sh
npm test          # deterministic simulation, solution routes, save validation
npm run build    # strict TypeScript check and production bundle in dist/
npm run preview  # serve production bundle
npm run test:e2e  # Chromium browser checks
```

Playwright uses `/usr/bin/chromium` in this cloud environment. Elsewhere set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to your installed browser, or run `npx playwright install chromium` to use Playwright's browser. The development server is started automatically for tests. Browser tests use real keyboard/pointer input for controls and accelerated simulation inputs for complete solution paths. They do not substitute elapsed wall-clock time for simulation ticks.

Deploy the contents of `dist/` to any static host. All assets are bundled. No server-side routing is needed.

## Controls

| Action               | Desktop                            | Touch                       |
| -------------------- | ---------------------------------- | --------------------------- |
| Move along room axes | WASD / arrows                      | Direction pad               |
| Interact nearby      | E                                  | E button                    |
| Rewind               | Hold R                             | Hold rewind button          |
| Scrub history        | Drag timeline / focused arrow keys | Drag timeline               |
| Commit current loop  | F                                  | Echo +                      |
| Pause                | Escape / Pause                     | Pause                       |
| Orbit camera         | Drag empty viewport                | Drag viewport               |
| Zoom                 | Mouse wheel                        | Use the default fitted view |

The countdown measures simulated time. A hidden tab pauses. Releasing rewind discards the abandoned future. Committing resets the room and plays your recorded path from tick zero; your Echo disappears at the end of the recorded duration. **Wait on a plate before committing**, so the Echo has time to hold it during your next route. Echoes cannot operate consoles or collect cores. With both slots occupied, a replacement chooser protects existing recordings.

**Retry current loop** preserves Echoes. **Reset entire room** and **Restart level** clear them. Failure also offers rewind and commit; it never silently deletes a recording. Three progressively more specific hints are available per room.

## Verified routes (spoilers)

The unit suite executes movement, interactions, waiting, recording, and hazards through the actual simulation; it does not teleport the player for solution tests.

- **R–00 / The first correction:** approach the amber console at (-2, 2), interact, return to the central aisle and walk through the gate. It stays open for 12 seconds; the exit is about 8 world units away and movement speed is 3 units/second. Rewind if you miss it.
- **R–01 / Hold the line:** walk left to the plate at (-3, 1), remain until 35 seconds into the recording, then commit. On the next loop, walk down the center and through the door while the Echo holds the plate.
- **R–02 / Split seconds:** make separate 35-second recordings on (-3, 1) and (3, 1). In the final loop, walk around the central block via (2, 3.8), (2, -0.7), then (0, -0.7), and take the exit.
- **R–03 / The moving window:** record 35 seconds ending on (-3, 2). Walk to the central ferry at the near edge. It makes a deterministic six-second round trip while the plate is powered. Ride across, approach the scanner at z = -3.65, and cross while dim. The scanner is active for the first 1.5 seconds of every four-second period.
- **R–04 / The paradox engine:** retain 35-second recordings on both plates. Collect the core at (3, 3.2), activate the console at (0, -0.4), and cross the scanner at z = -1.2 while dim. Both plates, core, and manual console power are required for the exit. Completing this chamber leads to the ending.

Coordinates use the room's floor plane, not screen directions. Every tested route uses at most two Echoes and finishes within 1,800 ticks. The final loop time is stored as a personal best; it excludes preparation loops.

## Architecture

- `src/core/Simulation.ts`: sole gameplay owner. Fixed 30 Hz rules, actor movement, axis-separated collision, interactions, plates, gates, core, deterministic ferry/scanner, outcomes, history and Echo recordings. No Three.js objects or browser dependencies.
- `src/core/FixedStepLoop.ts`: render-independent accumulator; resets on pause and limits catch-up after long stalls. Active time intentionally slows under extreme frame stalls instead of skipping collision or hazard ticks.
- `src/levels/rooms.ts`: five data-driven room definitions, geometry, components and hints.
- `src/world/WorldRenderer.ts`: procedural miniature architecture, orthographic camera, low cutaway walls, humanoids, Echo paths, lighting, door/platform/clock animations. Old room GPU resources are disposed on transitions.
- `src/app/App.ts`: explicit application modes, one animation loop, input, accessible DOM controls, touch controls, menus and progression.
- `src/app/SaveManager.ts`: versioned, validated local storage with corruption/privacy fallback.
- `src/audio/AudioManager.ts`: gesture-unlocked procedural ambience and event sounds.

History is bounded to 1,801 snapshots per active loop. Each snapshot copies all mutable puzzle state. Echo recordings contain only actor frames (position, facing, movement), with a maximum of two recordings of 1,801 frames each. Rewind samples retained history; it does not run rules backward. Resume truncates future snapshots and their events before new ticks. Echo occupancy is recomputed from the global loop tick and never depends on render cadence.

In development, press the backtick key to show tick, occupancy, door conditions and collision boundaries. Recorded paths are visible as subtle trails in normal play. `window.rewindDebug` exposes the development app/simulation for browser testing; it is omitted from production builds.

## Presentation and limits

Low/Medium/High graphics settings control shadows and pixel ratio. Reduced motion removes character gait and decorative core rotation. The game uses low cutaway partition walls to keep actors visible; there is no unrestricted camera that can go behind the back wall. Touch offers orbit and timeline scrubbing; mouse wheel zoom is desktop-only. Geometry and audio are procedural. Performance has been checked in cloud Chromium using software WebGL; physical-device and Safari/Firefox testing remain separate release checks.

The production build is static and has no external runtime requests. Development/browser automation dependencies are not included in the deployed game.
