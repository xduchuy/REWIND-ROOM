import * as T from "three";
import { Simulation, LIMIT } from "../core/Simulation";
export class WorldRenderer {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.OrthographicCamera(-9, 9, 7, -7, 0.1, 100);
  root = new T.Group();
  player = new T.Group();
  echoes: T.Group[] = [];
  plates: T.Mesh[] = [];
  door!: T.Group;
  platform?: T.Mesh;
  hazard?: T.Mesh;
  core?: T.Group;
  console?: T.Group;
  clock!: T.Group;
  trails: T.Line[] = [];
  debug = new T.Group();
  angle = 0.68;
  targetAngle = 0.68;
  zoom = 1;
  targetZoom = 1;
  reduced = false;
  quality = "medium";
  private drag?: number;
  private lastX = 0;
  private doorY = 0;
  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setClearColor(0x101820, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.scene.add(new T.HemisphereLight(0xb5d8df, 0x303034, 3));
    const sun = new T.DirectionalLight(0xffe0ab, 4);
    sun.position.set(-4, 12, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -10,
      right: 10,
      top: 10,
      bottom: -10,
    });
    sun.shadow.bias = -0.001;
    this.scene.add(sun);
    const cool = new T.DirectionalLight(0x86d8d7, 2);
    cool.position.set(6, 4, -6);
    this.scene.add(cool);
    this.scene.add(this.root);
    canvas.addEventListener("pointerdown", (e) => {
      this.drag = e.pointerId;
      this.lastX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (this.drag === e.pointerId) {
        this.targetAngle = T.MathUtils.clamp(
          this.targetAngle + (e.clientX - this.lastX) * 0.005,
          -0.65,
          1.35,
        );
        this.lastX = e.clientX;
      }
    });
    canvas.addEventListener("pointerup", () => (this.drag = undefined));
    canvas.addEventListener("pointercancel", () => (this.drag = undefined));
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.targetZoom = T.MathUtils.clamp(
          this.targetZoom - e.deltaY * 0.0006,
          0.65,
          1.35,
        );
      },
      { passive: false },
    );
    window.addEventListener("resize", () => this.resize());
    this.resize();
  }
  mat(color: number, emissive = 0) {
    return new T.MeshStandardMaterial({
      color,
      roughness: 0.78,
      metalness: 0.12,
      emissive,
      emissiveIntensity: 1,
    });
  }
  box(
    parent: T.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
    emissive = 0,
  ) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), this.mat(color, emissive));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  label(
    text: string,
    x: number,
    y: number,
    z: number,
    size = 1,
    color = "#E5D3B5",
  ) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.font = "500 64px monospace";
    ctx.textAlign = "center";
    ctx.fillText(text, 256, 84);
    const tex = new T.CanvasTexture(c);
    const mesh = new T.Mesh(
      new T.PlaneGeometry(size * 4, size),
      new T.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
      }),
    );
    mesh.position.set(x, y, z);
    this.root.add(mesh);
    return mesh;
  }
  character(echo = false, index = 0) {
    const g = new T.Group();
    const color = echo ? (index ? 0xb8b2f1 : 0x86d8d7) : 0xe5d3b5;
    this.box(g, 0, 0.54, 0, 0.36, 0.48, 0.27, color);
    this.box(g, 0, 0.94, 0, 0.35, 0.32, 0.32, color);
    this.box(g, 0, 0.95, 0.17, 0.27, 0.1, 0.025, 0x172832, echo ? 0x86d8d7 : 0);
    this.box(g, -0.12, 0.17, 0, 0.13, 0.32, 0.16, echo ? color : 0x525f64);
    this.box(g, 0.12, 0.17, 0, 0.13, 0.32, 0.16, echo ? color : 0x525f64);
    this.box(g, -0.26, 0.55, 0, 0.12, 0.4, 0.14, color);
    this.box(g, 0.26, 0.55, 0, 0.12, 0.4, 0.14, color);
    this.box(g, 0, 0.56, -0.18, 0.25, 0.27, 0.16, echo ? color : 0xa67553);
    if (echo)
      g.traverse((o) => {
        if (o instanceof T.Mesh) {
          o.material.transparent = true;
          o.material.opacity = 0.42;
          o.material.emissive = new T.Color(color);
          o.material.emissiveIntensity = 0.35;
          o.castShadow = false;
        }
      });
    return g;
  }
  load(sim: Simulation) {
    this.root.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.Line) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if ("map" in m) (m as T.MeshBasicMaterial).map?.dispose();
          m.dispose();
        }
      }
    });
    this.root.clear();
    this.plates = [];
    this.echoes = [];
    this.trails = [];
    this.platform = undefined;
    this.hazard = undefined;
    this.core = undefined;
    this.console = undefined;
    this.doorY = 0;
    const r = sim.room;
    this.box(this.root, 0, -0.65, 0, 12.5, 0.85, 10.5, 0x26363d);
    this.box(this.root, 0, -1.15, 0, 12, 0.18, 10, 0x15232a);
    for (let x = -5.5; x < 6; x++)
      for (let z = -4.5; z < 5; z++) {
        if (r.gap && z > -2.4 && z < 0.3) continue;
        this.box(
          this.root,
          x,
          -0.16,
          z,
          0.97,
          0.25,
          0.97,
          Math.round(x + z) % 3 === 0 ? 0x5c6667 : 0x697171,
        );
      }
    // Back wall and low side walls preserve the miniature silhouette and camera visibility.
    this.box(this.root, 0, 1.35, -5.15, 12.5, 3, 0.3, 0x53616a);
    this.box(this.root, -6.15, 0.4, 0, 0.3, 1.1, 10.5, 0x53616a);
    this.box(this.root, 6.15, 0.4, 0, 0.3, 1.1, 10.5, 0x53616a);
    for (const w of r.walls)
      this.box(this.root, w.x, 0.4, w.z, w.w, 0.9, w.d, 0x3c4c55);
    const gz = r.gap ? -3 : -2;
    this.door = new T.Group();
    this.root.add(this.door);
    this.door.position.set(0, 0, gz);
    this.box(this.door, 0, 0.85, 0, 1.9, 1.7, 0.22, 0x8b918a);
    for (const x of [-0.75, 0.75])
      this.box(this.door, x, 0.85, 0.13, 0.04, 1.5, 0.02, 0x86d8d7, 0x427f7e);
    for (const x of [-1.08, 1.08])
      this.box(this.root, x, 1, gz, 0.18, 2, 0.5, 0x263840);
    this.box(this.root, 0, 2, gz, 2.35, 0.15, 0.5, 0x263840);
    this.box(this.root, 0, 0.015, -4.4, 1.6, 0.04, 0.7, 0x86d8d7, 0x468d89);
    this.label("EXIT", 0, 1, -4.96, 0.35, "#86d8d7");
    this.label("R—0" + r.id, -3, 1.8, -4.96, 0.6);
    r.plates.forEach((p, i) => {
      this.box(this.root, p.x, 0.025, p.z, 1.25, 0.1, 1.25, 0x273e47);
      const m = this.box(
        this.root,
        p.x,
        0.09,
        p.z,
        0.97,
        0.06,
        0.97,
        i ? 0x9a95bd : 0x86d8d7,
      );
      this.plates.push(m);
      this.label(
        String(i + 1).padStart(2, "0"),
        p.x,
        0.2,
        p.z,
        0.18,
      ).rotation.x = -Math.PI / 2;
    });
    if (r.console) {
      this.console = new T.Group();
      this.console.position.set(r.console.x, 0, r.console.z);
      this.root.add(this.console);
      this.box(this.console, 0, 0.43, 0, 0.6, 0.85, 0.5, 0x293c45);
      this.box(this.console, 0, 0.89, 0, 0.5, 0.09, 0.4, 0xe5b67c, 0x7b421b);
      this.box(
        this.console,
        0,
        0.63,
        0.27,
        0.24,
        0.12,
        0.03,
        0x86d8d7,
        0x427f7e,
      );
    }
    if (r.core) {
      this.core = new T.Group();
      this.core.position.set(r.core.x, 0.7, r.core.z);
      this.root.add(this.core);
      const m = new T.Mesh(
        new T.OctahedronGeometry(0.25),
        this.mat(0xf9c780, 0x9e6f32),
      );
      this.core.add(m);
      this.box(this.root, r.core.x, 0.18, r.core.z, 0.6, 0.35, 0.6, 0x31424a);
    }
    if (r.gap) {
      this.platform = this.box(
        this.root,
        0,
        -0.04,
        0.6,
        1.6,
        0.16,
        1.3,
        0xb59564,
      );
      for (const x of [-0.9, 0.9])
        this.box(this.root, x, -0.25, -1, 0.06, 0.1, 3.4, 0xb59869);
    }
    if (r.hazard) {
      this.hazard = this.box(
        this.root,
        0,
        0.35,
        r.gap ? -3.65 : -1.2,
        11.8,
        0.035,
        0.06,
        0xea9279,
        0xcc452a,
      );
      for (const x of [-5.7, 5.7])
        this.box(
          this.root,
          x,
          0.3,
          this.hazard.position.z,
          0.25,
          0.6,
          0.3,
          0x6d5753,
        );
    }
    this.clock = new T.Group();
    this.clock.position.set(3.7, 1.9, -4.91);
    this.root.add(this.clock);
    const face = new T.Mesh(
      new T.CylinderGeometry(0.55, 0.55, 0.08, 48),
      this.mat(0xe5d3b5),
    );
    face.rotation.x = Math.PI / 2;
    this.clock.add(face);
    this.box(this.clock, 0, 0.2, 0.06, 0.035, 0.4, 0.04, 0x243740);
    this.box(this.clock, 0, 0, 0.07, 0.12, 0.12, 0.04, 0x243740);
    for (const x of [-4.8, 4.8]) {
      this.box(this.root, x, 2.3, -4.85, 0.8, 0.06, 0.2, 0xffd6a0, 0xc18b4c);
      const l = new T.PointLight(0xffc880, 3, 4);
      l.position.set(x, 2, -4);
      this.root.add(l);
    }
    for (let i = 0; i < 3 + r.id; i++) {
      const x = -5.3 + i * 0.32;
      this.box(this.root, x, 0.14, 4.5, 0.16, 0.3, 0.4, 0x34434b);
    }
    this.player = this.character();
    this.root.add(this.player);
    for (let i = 0; i < 2; i++) {
      const g = this.character(true, i);
      g.visible = false;
      this.echoes.push(g);
      this.root.add(g);
    }
    this.debug = new T.Group();
    this.debug.visible = false;
    this.root.add(this.debug);
    for (const w of r.walls) {
      const g = new T.EdgesGeometry(
        new T.BoxGeometry(w.w + 0.46, 0.2, w.d + 0.46),
      );
      const line = new T.LineSegments(
        g,
        new T.LineBasicMaterial({ color: 0xea9279 }),
      );
      line.position.set(w.x, 0.1, w.z);
      this.debug.add(line);
    }
    this.updateTrails(sim);
  }
  updateTrails(sim: Simulation) {
    for (const t of this.trails) {
      this.root.remove(t);
      t.geometry.dispose();
      (t.material as T.Material).dispose();
    }
    this.trails = [];
    sim.echoes.forEach((e, i) => {
      const pts = e.frames
        .filter((_, t) => t % 5 === 0)
        .map((p) => new T.Vector3(p.x, 0.04, p.z));
      const line = new T.Line(
        new T.BufferGeometry().setFromPoints(pts),
        new T.LineBasicMaterial({
          color: i ? 0xb8b2f1 : 0x86d8d7,
          transparent: true,
          opacity: 0.2,
        }),
      );
      this.root.add(line);
      this.trails.push(line);
    });
  }
  resize() {
    const w = this.canvas.clientWidth,
      h = this.canvas.clientHeight;
    this.renderer.setPixelRatio(
      Math.min(
        devicePixelRatio,
        this.quality === "low" ? 1 : this.quality === "high" ? 2 : 1.5,
      ),
    );
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    const height = Math.max(7.8, 8.6 / aspect);
    this.camera.left = -height * aspect;
    this.camera.right = height * aspect;
    this.camera.top = height;
    this.camera.bottom = -height;
    this.camera.updateProjectionMatrix();
  }
  render(sim: Simulation, time: number) {
    const s = sim.state;
    this.angle += (this.targetAngle - this.angle) * 0.1;
    this.zoom += (this.targetZoom - this.zoom) * 0.1;
    this.camera.position.set(
      Math.sin(this.angle) * 16,
      14,
      Math.cos(this.angle) * 16,
    );
    this.camera.lookAt(0, 0, 0);
    this.camera.zoom = this.zoom;
    this.camera.updateProjectionMatrix();
    const actor = (
      g: T.Group,
      a: { x: number; z: number; facing: number; moving: boolean },
      phase: number,
    ) => {
      g.position.set(a.x, 0, a.z);
      g.rotation.y = a.facing;
      const swing =
        !this.reduced && a.moving ? Math.sin(phase * 0.65) * 0.4 : 0;
      g.children[3].rotation.x = swing;
      g.children[4].rotation.x = -swing;
      g.children[5].rotation.x = -swing;
      g.children[6].rotation.x = swing;
    };
    actor(this.player, s.player, s.tick);
    if (
      !this.reduced &&
      s.events.length &&
      s.tick - s.events[s.events.length - 1] < 10
    )
      this.player.children[6].rotation.x = -1.2;
    if (s.outcome === "won" && !this.reduced)
      this.player.position.y = Math.sin(time * 2) * 0.06;
    this.echoes.forEach((g, i) => {
      const e = sim.echoes[i],
        a = e && sim.echoAt(e);
      g.visible = !!a;
      if (a) {
        actor(g, a, s.tick);
        const opacity = Math.min(
          0.45,
          Math.max(0, (e.duration - s.tick) / 20) * 0.45,
        );
        g.traverse((o) => {
          if (o instanceof T.Mesh) o.material.opacity = opacity;
        });
      }
    });
    this.plates.forEach((p, i) => {
      const m = p.material as T.MeshStandardMaterial;
      m.emissive.setHex(s.plates[i] ? 0x67b3ad : 0x102c33);
      p.position.y = s.plates[i] ? 0.055 : 0.09;
    });
    this.doorY +=
      ((s.door ? -1.9 : 0) - this.doorY) * (this.reduced ? 1 : 0.18);
    this.door.position.y = this.doorY;
    if (this.platform) this.platform.position.z = s.platform;
    if (this.hazard) {
      this.hazard.visible = true;
      (this.hazard.material as T.MeshStandardMaterial).emissiveIntensity =
        s.hazardPhase < 45 ? 2 : 0;
      this.hazard.scale.y = s.hazardPhase < 45 ? 1 : 0.2;
      (this.hazard.material as T.MeshStandardMaterial).color.setHex(
        s.hazardPhase < 45 ? 0xea9279 : 0x4a5558,
      );
    }
    if (this.console) {
      const indicator = this.console.children[1] as T.Mesh;
      (indicator.material as T.MeshStandardMaterial).emissive.setHex(
        s.switchOn ? 0x65a99d : 0x7b421b,
      );
    }
    if (this.core) {
      this.core.visible = !s.core;
      this.core.rotation.y = this.reduced ? 0 : time * 0.8;
    }
    this.clock.children[1].rotation.z = (-s.tick / LIMIT) * Math.PI * 2;
    this.renderer.render(this.scene, this.camera);
  }
  setQuality(q: string) {
    this.quality = q;
    this.renderer.shadowMap.enabled = q !== "low";
    this.resize();
  }
}
