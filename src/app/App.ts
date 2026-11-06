import { Simulation, LIMIT } from "../core/Simulation";
import { FixedStepLoop } from "../core/FixedStepLoop";
import { rooms } from "../levels/rooms";
import { WorldRenderer } from "../world/WorldRenderer";
import { AudioManager } from "../audio/AudioManager";
import { loadSave, saveData } from "./SaveManager";
export type Mode =
  | "BOOT"
  | "LOADING"
  | "MAIN_MENU"
  | "LEVEL_SELECT"
  | "PLAYING"
  | "REWINDING"
  | "PAUSED"
  | "LOOP_FAILED"
  | "LEVEL_COMPLETE"
  | "GAME_COMPLETE";
export class App {
  mode: Mode = "BOOT";
  sim = new Simulation();
  loop = new FixedStepLoop();
  audio = new AudioManager();
  save = loadSave();
  view: WorldRenderer;
  keys = new Set<string>();
  hint = 0;
  private interact = false;
  private last = 0;
  private scrubbing = false;
  private returnMode: Mode = "MAIN_MENU";
  private replacement = false;
  private root: HTMLElement;
  private overlay: HTMLElement;
  private hud: HTMLElement;
  private timeline: HTMLInputElement;
  private prompt: HTMLElement;
  private notice: HTMLElement;
  constructor(root: HTMLElement) {
    this.root = root;
    root.innerHTML = `<canvas id="world" aria-label="Three dimensional puzzle chamber. Use WASD to move."></canvas><div class="grain"></div><header class="brand"><span class="brandmark">↶</span> REWIND ROOM <span class="edition">TEMPORAL RESEARCH DIVISION</span></header><div id="hud" hidden><div class="room-label"><small id="room-id"></small><h1 id="room-title"></h1><p id="room-subtitle"></p></div><div class="timer"><small>CYCLE REMAINING</small><strong id="countdown">60<span>.00</span></strong><i></i></div><div class="echo-panel"><small>RETAINED HISTORIES</small><div id="slots"></div><span class="recording">● RECORDING THIS LOOP</span></div><div id="prompt" role="status"></div><div class="timeline-wrap"><div class="timeline-caption"><span id="timeline-state">LIVE TIMELINE</span><span id="elapsed">00.00 / 60.00</span></div><div id="markers"></div><input id="timeline" type="range" min="0" max="1800" value="0" aria-label="Rewind timeline"><div class="timeline-caption"><span><kbd>R</kbd> HOLD TO REWIND</span><span><kbd>F</kbd> COMMIT ECHO</span></div></div><div class="tools"><button data-action="hint">? Hint</button><button data-action="pause">Pause</button></div><div class="controls-legend"><kbd>W A S D</kbd> MOVE <b>·</b> <kbd>E</kbd> INTERACT <b>·</b> DRAG TO ORBIT</div><div class="mobile-controls"><div class="dpad"><button data-key="arrowup" aria-label="Move forward">↑</button><button data-key="arrowleft" aria-label="Move left">←</button><button data-key="arrowdown" aria-label="Move backward">↓</button><button data-key="arrowright" aria-label="Move right">→</button></div><div class="touch-actions"><button data-action="interact">E</button><button data-key="r" aria-label="Hold to rewind">↶</button><button data-action="commit">Echo +</button></div></div><pre id="debug" hidden></pre></div><div id="notice" role="status"></div><section id="overlay" aria-live="polite"></section><footer class="footer"><span>A STUDY IN SECOND CHANCES</span><span>EST. 2086 <b> / </b> VOL. 01</span></footer>`;
    this.overlay = root.querySelector("#overlay")!;
    this.hud = root.querySelector("#hud")!;
    this.timeline = root.querySelector("#timeline")!;
    this.prompt = root.querySelector("#prompt")!;
    this.notice = root.querySelector("#notice")!;
    this.mode = "LOADING";
    this.view = new WorldRenderer(root.querySelector("canvas")!);
    this.view.setQuality(this.save.quality);
    this.view.reduced = this.save.reduced;
    this.audio.set(this.save.master, this.save.effects);
    this.view.load(this.sim);
    this.bind();
    this.menu();
    requestAnimationFrame((t) => this.frame(t));
    if (import.meta.env.DEV)
      (window as unknown as { rewindDebug: unknown }).rewindDebug = {
        app: this,
        sim: () => this.sim,
      };
  }
  private bind() {
    this.root.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>(
        "[data-action]",
      );
      if (b && !b.disabled) {
        this.audio.start();
        this.action(b.dataset.action!);
      }
    });
    window.addEventListener("keydown", (e) => {
      if ((e.target as HTMLElement).matches("input,select")) return;
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k))
        e.preventDefault();
      this.keys.add(k);
      if (e.repeat) return;
      if (k === "escape") {
        if (this.mode === "PLAYING" || this.mode === "REWINDING") this.pause();
        else if (this.mode === "PAUSED") this.play();
      }
      if (k === "e") this.interact = true;
      if (k === "f" && (this.mode === "PLAYING" || this.mode === "LOOP_FAILED"))
        this.commit();
      if (k === "r" && ["PLAYING", "LOOP_FAILED"].includes(this.mode))
        this.beginRewind();
      if (k === "`" && import.meta.env.DEV) {
        this.view.debug.visible = !this.view.debug.visible;
        this.root.querySelector<HTMLElement>("#debug")!.hidden =
          !this.view.debug.visible;
      }
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.key.toLowerCase());
      if (
        e.key.toLowerCase() === "r" &&
        this.mode === "REWINDING" &&
        !this.scrubbing
      )
        this.endRewind();
    });
    window.addEventListener("blur", () => {
      this.keys.clear();
      if (this.mode === "PLAYING" || this.mode === "REWINDING") this.pause();
    });
    document.addEventListener("visibilitychange", () => {
      if (
        document.hidden &&
        (this.mode === "PLAYING" || this.mode === "REWINDING")
      )
        this.pause();
    });
    this.timeline.addEventListener("pointerdown", () => {
      if (["PLAYING", "REWINDING", "LOOP_FAILED"].includes(this.mode)) {
        this.scrubbing = true;
        this.beginRewind();
      }
    });
    this.timeline.addEventListener("input", () => {
      if (!["PLAYING", "REWINDING", "LOOP_FAILED"].includes(this.mode)) return;
      this.beginRewind();
      this.sim.seek(Number(this.timeline.value));
      this.updateHUD();
    });
    this.timeline.addEventListener("change", () => {
      this.scrubbing = false;
      if (this.mode === "REWINDING") this.endRewind();
    });
    this.timeline.addEventListener("pointercancel", () => {
      this.scrubbing = false;
      if (this.mode === "REWINDING") this.endRewind();
    });
    this.root.querySelectorAll<HTMLElement>("[data-key]").forEach((b) => {
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        this.audio.start();
        b.setPointerCapture(e.pointerId);
        this.keys.add(b.dataset.key!);
        if (b.dataset.key === "r") this.beginRewind();
      });
      const release = () => {
        this.keys.delete(b.dataset.key!);
        if (b.dataset.key === "r" && this.mode === "REWINDING")
          this.endRewind();
      };
      b.addEventListener("pointerup", release);
      b.addEventListener("pointercancel", release);
    });
  }
  private setMode(m: Mode) {
    this.mode = m;
    this.keys.clear();
    this.interact = false;
    this.loop.reset();
    this.root.dataset.mode = m;
    this.hud.hidden = [
      "MAIN_MENU",
      "LEVEL_SELECT",
      "GAME_COMPLETE",
      "BOOT",
      "LOADING",
    ].includes(m);
  }
  private modal(kicker: string, title: string, body: string, buttons: string) {
    this.overlay.hidden = false;
    this.overlay.innerHTML = `<div class="modal"><small class="eyebrow">${kicker}</small><h2>${title}</h2><div class="modal-body">${body}</div><div class="menu-actions">${buttons}</div></div>`;
    this.overlay
      .querySelector<HTMLElement>("button")
      ?.focus({ preventScroll: true });
  }
  private button(label: string, action: string, primary = false) {
    return `<button data-action="${action}" class="${primary ? "primary" : ""}">${label}<span aria-hidden="true">→</span></button>`;
  }
  menu() {
    this.setMode("MAIN_MENU");
    this.overlay.hidden = false;
    this.overlay.innerHTML = `<div class="title-layout"><div class="title-copy"><small class="eyebrow"><span class="status-dot"></span> THE EXPERIMENT IS WAITING</small><h2>Time is a room.<br><em>Find your way<br>out.</em></h2><p>A sixty-second loop. Five impossible rooms.<br>The only person who can help you is<br>the person you were a moment ago.</p><div class="menu-actions">${this.button(this.save.unlocked ? "Continue experiment" : "Begin experiment", "begin", true)}${this.button("Chamber archive", "levels")}${this.button("Sound & display", "settings")}</div><div class="title-note"><span>01 — 05</span><span>MOVE. REWIND. COEXIST.</span></div></div><div class="scene-caption"><span class="crosshair">+</span><div><small>CHAMBER R–00</small><p>The first correction</p></div><span class="caption-line"></span></div></div>`;
  }
  start(id: number) {
    this.sim = new Simulation(id);
    this.view.load(this.sim);
    this.hint = 0;
    this.play();
    this.toast(rooms[id].hints[0]);
  }
  play() {
    this.replacement = false;
    this.setMode("PLAYING");
    this.overlay.hidden = true;
    this.updateHUD();
  }
  pause() {
    if (this.mode === "REWINDING") this.sim.resume();
    this.scrubbing = false;
    this.setMode("PAUSED");
    this.modal(
      "TEMPORAL SUSPENSION",
      "Take your time.",
      "The room will wait for you.",
      this.button("Resume", "resume", true) +
        this.button("Retry current loop · keep Echoes", "retry") +
        this.button("Reset entire room · clear Echoes", "reset") +
        this.button("Restart level", "restart") +
        this.button("Sound & display", "settings") +
        this.button("Return to main menu", "menu"),
    );
  }
  beginRewind() {
    if (!["PLAYING", "LOOP_FAILED", "REWINDING"].includes(this.mode)) return;
    if (this.mode !== "REWINDING") {
      this.mode = "REWINDING";
      this.root.dataset.mode = this.mode;
      this.overlay.hidden = true;
      this.sim.seek(this.sim.state.tick);
      this.audio.tone("rewind");
    }
  }
  endRewind() {
    this.sim.resume();
    if (this.sim.state.outcome === "failed") {
      this.failure();
      return;
    }
    if (this.sim.state.outcome === "won") {
      this.complete();
      return;
    }
    this.play();
  }
  commit(replace?: number) {
    if (this.sim.state.tick === 0) {
      this.toast("Record a little history first.");
      return;
    }
    if (!this.sim.commit(replace)) {
      this.replacement = true;
      this.setMode("PAUSED");
      this.modal(
        "TWO HISTORIES RETAINED",
        "Choose a history.",
        "Both slots are occupied. Choose which recording this loop will replace.",
        this.button("Replace Echo 01", "replace0") +
          this.button("Replace Echo 02", "replace1") +
          this.button("Keep both · cancel", "cancelreplace"),
      );
      return;
    }
    this.view.updateTrails(this.sim);
    this.audio.tone("echo");
    this.play();
    this.toast("History retained. Your past self is on its way.");
  }
  private failure() {
    this.setMode("LOOP_FAILED");
    this.audio.tone("fail");
    this.modal(
      "LOOP INTERRUPTED",
      "Another chance.",
      this.sim.state.reason +
        "<p>Retained Echoes are safe. Hold R to correct the attempt.</p>",
      this.button("Rewind five seconds", "recover", true) +
        this.button("Retry current loop · keep Echoes", "retry") +
        this.button("Commit this recording", "commit") +
        this.button("Reset entire room", "reset") +
        this.button("Main menu", "menu"),
    );
  }
  private complete() {
    const id = this.sim.room.id;
    this.save.unlocked = Math.max(this.save.unlocked, Math.min(4, id + 1));
    if (!this.save.completed.includes(id)) this.save.completed.push(id);
    const t = this.sim.state.tick / 30;
    this.save.best[id] = Math.min(this.save.best[id] ?? 60, t);
    saveData(this.save);
    this.setMode("LEVEL_COMPLETE");
    this.audio.tone("win");
    this.modal(
      "CHAMBER RESOLVED",
      id === 4 ? "The experiment is over." : "A future opens.",
      `<p>${rooms[id].title}</p><div class="result"><strong>${t.toFixed(2)}s</strong><span>FINAL LOOP<br>${this.sim.echoes.length} ECHOES RETAINED</span></div>`,
      this.button(
        id === 4 ? "Leave the facility" : "Enter next chamber",
        "next",
        true,
      ) +
        this.button("Replay this room", "restart") +
        this.button("Chamber archive", "levels"),
    );
  }
  private levels() {
    this.setMode("LEVEL_SELECT");
    this.modal(
      "THE CHAMBER ARCHIVE",
      "Five rooms. One you.",
      "Each history leaves a door open.",
      rooms
        .map(
          (r) =>
            `<button data-action="room${r.id}" ${r.id > this.save.unlocked ? "disabled" : ""}><span>R–0${r.id} / ${r.title}</span><span>${r.id > this.save.unlocked ? "LOCKED" : this.save.completed.includes(r.id) ? "✓" : "→"}</span></button>`,
        )
        .join("") + this.button("Back", "menu"),
    );
  }
  private settings() {
    this.returnMode = this.mode;
    if (this.mode === "PLAYING") this.pause();
    this.setMode("PAUSED");
    this.modal(
      "CALIBRATION",
      "Make yourself at home.",
      `<label>Master volume<input id="master" type="range" min="0" max="1" step=".05" value="${this.save.master}"></label><label>Effects volume<input id="effects" type="range" min="0" max="1" step=".05" value="${this.save.effects}"></label><label>Graphics quality<select id="quality">${["low", "medium", "high"].map((q) => `<option ${q === this.save.quality ? "selected" : ""}>${q}</option>`).join("")}</select></label><label class="check">Reduced motion<input id="reduced" type="checkbox" ${this.save.reduced ? "checked" : ""}></label>`,
      this.button("Save & return", "save-settings", true),
    );
  }
  private action(a: string) {
    if (a === "begin") this.start(this.save.unlocked);
    else if (a.startsWith("room")) this.start(Number(a.slice(4)));
    else if (a === "menu") this.menu();
    else if (a === "levels") this.levels();
    else if (a === "pause") this.pause();
    else if (a === "resume") this.play();
    else if (a === "retry") {
      this.sim.retry();
      this.play();
    } else if (a === "reset" || a === "restart") {
      this.sim.reset();
      this.view.updateTrails(this.sim);
      this.play();
    } else if (a === "commit") this.commit();
    else if (a === "replace0" || a === "replace1")
      this.commit(Number(a.slice(-1)));
    else if (a === "cancelreplace") {
      this.replacement = false;
      if (this.sim.state.outcome === "failed") this.failure();
      else this.play();
    } else if (a === "recover") {
      this.sim.seek(Math.max(0, this.sim.state.tick - 150));
      this.sim.resume();
      this.play();
    } else if (a === "next") {
      if (this.sim.room.id < 4) this.start(this.sim.room.id + 1);
      else {
        this.setMode("GAME_COMPLETE");
        this.modal(
          "END OF EXPERIMENT / 05 OF 05",
          "You made time.",
          '<p>Somewhere behind you, five clocks have stopped.</p><p>You step into a morning that has never happened before.<br>For once, there is no need to return.</p><p class="ending-sign">Thank you for playing REWIND ROOM.</p>',
          this.button("Return to the archive", "levels", true) +
            this.button("Main menu", "menu"),
        );
      }
    } else if (a === "hint") {
      this.toast(rooms[this.sim.room.id].hints[this.hint % 3]);
      this.hint++;
    } else if (a === "settings") this.settings();
    else if (a === "save-settings") {
      this.save.master = Number(
        this.root.querySelector<HTMLInputElement>("#master")!.value,
      );
      this.save.effects = Number(
        this.root.querySelector<HTMLInputElement>("#effects")!.value,
      );
      this.save.quality = this.root.querySelector<HTMLSelectElement>(
        "#quality",
      )!.value as typeof this.save.quality;
      this.save.reduced =
        this.root.querySelector<HTMLInputElement>("#reduced")!.checked;
      saveData(this.save);
      this.audio.set(this.save.master, this.save.effects);
      this.view.setQuality(this.save.quality);
      this.view.reduced = this.save.reduced;
      if (this.returnMode === "MAIN_MENU") this.menu();
      else this.pause();
    } else if (a === "interact") this.interact = true;
  }
  private toastTimer = 0;
  toast(t: string) {
    this.notice.textContent = t;
    this.notice.classList.add("visible");
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(
      () => this.notice.classList.remove("visible"),
      9000,
    );
  }
  private updateHUD() {
    const s = this.sim.state,
      r = this.sim.room;
    this.root.querySelector("#room-id")!.textContent =
      `CHAMBER R–0${r.id} / 0${r.id + 1} OF 05`;
    this.root.querySelector("#room-title")!.textContent = r.title;
    this.root.querySelector("#room-subtitle")!.textContent = r.subtitle;
    const left = (60 - s.tick / 30).toFixed(2).split(".");
    this.root.querySelector("#countdown")!.innerHTML =
      `${left[0].padStart(2, "0")}<span>.${left[1]}</span>`;
    this.root
      .querySelector(".timer")!
      .classList.toggle("urgent", s.tick > 1500);
    this.root.querySelector<HTMLElement>(".timer i")!.style.width =
      `${100 * (1 - s.tick / LIMIT)}%`;
    this.timeline.value = String(s.tick);
    this.timeline.style.setProperty("--progress", `${(s.tick / LIMIT) * 100}%`);
    this.root.querySelector("#elapsed")!.textContent =
      `${(s.tick / 30).toFixed(2)} / 60.00`;
    this.root.querySelector("#timeline-state")!.textContent =
      this.mode === "REWINDING" ? "↶ REWRITING HISTORY" : "● LIVE TIMELINE";
    this.root.querySelector("#slots")!.innerHTML = [0, 1]
      .map((i) => {
        const e = this.sim.echoes[i];
        return `<span class="slot ${e ? "filled" : ""}">${e ? "◈" : "◇"} <b>0${i + 1}</b> <small>${e ? (s.tick <= e.duration ? "REPLAYING" : "EXPIRED") : "EMPTY"}</small></span>`;
      })
      .join("");
    this.prompt.textContent = this.sim.context();
    this.root.querySelector("#markers")!.innerHTML = s.events
      .map((t) => `<i style="left:${(t / LIMIT) * 100}%"></i>`)
      .join("");
    if (import.meta.env.DEV)
      this.root.querySelector("#debug")!.textContent =
        `Tick ${s.tick}\nPlates ${s.plates.join(", ")}\nGate ${s.door ? "OPEN" : "CLOSED"}\nPower ${s.switchOn} / Core ${s.core}\nPlatform ${s.platform.toFixed(2)} / Scanner ${s.hazardPhase}`;
  }
  private frame(t: number) {
    const dt = this.last ? (t - this.last) / 1000 : 0;
    this.last = t;
    if (this.mode === "REWINDING" && !this.scrubbing && this.keys.has("r")) {
      this.loop.advance(dt, true, () => this.sim.seek(this.sim.state.tick - 3));
      this.updateHUD();
    } else
      this.loop.advance(dt, this.mode === "PLAYING", () => {
        if (this.mode !== "PLAYING") return;
        const before = this.sim.state;
        const door = before.door,
          plates = before.plates.join(),
          events = before.events.length;
        this.sim.step({
          x:
            Number(this.keys.has("d") || this.keys.has("arrowright")) -
            Number(this.keys.has("a") || this.keys.has("arrowleft")),
          z:
            Number(this.keys.has("s") || this.keys.has("arrowdown")) -
            Number(this.keys.has("w") || this.keys.has("arrowup")),
          interact: this.interact,
        });
        this.interact = false;
        const s = this.sim.state;
        if (s.events.length !== events) this.audio.tone("switch");
        if (s.door !== door) this.audio.tone("door");
        if (s.plates.join() !== plates) this.audio.tone("plate");
        if (s.tick % 30 === 0) this.audio.tone("tick");
        if (s.outcome === "failed") this.failure();
        else if (s.outcome === "won") this.complete();
      });
    if (!this.hud.hidden) this.updateHUD();
    this.view.render(this.sim, t / 1000);
    requestAnimationFrame((n) => this.frame(n));
  }
}
