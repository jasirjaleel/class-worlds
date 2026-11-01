import * as THREE from "three";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { windTime } from "./nature";

export interface StageOptions {
  lowGraphics: boolean;
  background: string;
  /** Free Roam: the teacher can drag, zoom and pan the camera. */
  roam?: boolean;
}

/** Area the diorama camera must always keep fully in view (x/z on the ground). */
export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Height range to keep in view (default 0–4). */
  minY?: number;
  maxY?: number;
}

const UP = new THREE.Vector3(0, 1, 0);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Renderer, lights and the fixed "diorama" camera: an angled orthographic view
 * that keeps every student on screen. A reward briefly zooms in on one spot.
 */
export class Stage {
  readonly scene = new THREE.Scene();
  camera: THREE.OrthographicCamera | THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly labels = new CSS2DRenderer();
  fps = 0;

  private bounds: Bounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
  // 35° down, slightly from the left: reads as a model on a table
  private cameraOffset = new THREE.Vector3(-18, 34, 48);
  private dayLights: THREE.Light[] = [];
  /** Where the camera actually sits right now, relative to its target. */
  private view = new THREE.Vector3();
  private driftAngle = 0;
  private depthFog: { color: THREE.ColorRepresentation; near: number; far: number } | null = null;
  private home = { target: new THREE.Vector3(), zoom: 1 };
  private focus: { target: THREE.Vector3; zoom: number; start: number; hold: number } | null = null;
  private target = new THREE.Vector3();
  private controls: OrbitControls | null = null;
  private onTick: ((dt: number, time: number) => void) | null = null;
  private raf = 0;
  private resizeObserver: ResizeObserver;
  private frames = 0;
  private fpsClock = 0;

  constructor(private container: HTMLElement, private opts: StageOptions) {
    this.renderer = new THREE.WebGLRenderer({ antialias: !opts.lowGraphics, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(opts.lowGraphics ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !opts.lowGraphics;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // the way a film camera handles bright light, so nothing looks flat or clipped
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    container.appendChild(this.renderer.domElement);

    this.labels.domElement.style.position = "absolute";
    this.labels.domElement.style.inset = "0";
    this.labels.domElement.style.pointerEvents = "none";
    container.appendChild(this.labels.domElement);

    this.scene.background = new THREE.Color(opts.background);

    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 1000);
    this.camera.position.copy(this.cameraOffset);
    this.camera.lookAt(0, 0, 0);

    const hemi = new THREE.HemisphereLight("#ffffff", "#445066", 1.6);
    const sun = new THREE.DirectionalLight("#fff4e0", 2.2);
    sun.position.set(-20, 40, 25);
    sun.castShadow = !opts.lowGraphics;
    sun.shadow.mapSize.set(2048, 2048);
    const s = sun.shadow.camera;
    s.left = -60; s.right = 60; s.top = 60; s.bottom = -60; s.far = 200;
    this.scene.add(hemi, sun);
    this.dayLights = [hemi, sun];

    this.createControls();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  start(onTick: (dt: number, time: number) => void) {
    this.onTick = onTick;
    let last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      this.countFps(now);
      windTime.value = now / 1000;
      this.updateCamera(now);
      this.onTick?.(dt, now / 1000);
      this.controls?.update();
      this.renderer.render(this.scene, this.camera);
      this.labels.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Set what must stay in view; the camera zooms to fit it. */
  fit(bounds: Bounds) {
    this.bounds = bounds;
    this.resize();
  }

  /** Where the camera sits relative to what it looks at. Worlds can pick their own angle. */
  setCameraOffset(offset: THREE.Vector3) {
    this.cameraOffset.copy(offset);
    this.resize();
  }

  /**
   * Switch to a real-depth camera, where far things look smaller. A narrow `fov`
   * (a long lens) keeps distant students from shrinking much. `direction` is the
   * side to view from; the distance is worked out to fit the bounds.
   */
  useDepthCamera(fov: number, direction: THREE.Vector3) {
    this.camera = new THREE.PerspectiveCamera(fov, 1, 1, 3000);
    this.cameraOffset.copy(direction).normalize();
    this.controls?.dispose();
    this.createControls();
    this.resize();
  }

  /** A very slow sideways sway of the camera, in radians, so the scene feels alive. */
  setDrift(angle: number) {
    this.driftAngle = angle;
  }

  /** Haze that starts `near` units behind the framed scene and is solid `far` units behind it. */
  setDepthFog(color: THREE.ColorRepresentation, near: number, far: number) {
    this.depthFog = { color, near, far };
    this.applyDepthFog();
  }

  /** "space" turns off the daylight so a world can light itself (e.g. from its Sun). */
  setLighting(mode: "day" | "space") {
    for (const light of this.dayLights) light.visible = mode === "day";
  }

  /** Zoom on a point for `holdMs`, then glide back to the whole class. */
  focusOn(point: THREE.Vector3, zoom = 2.4, holdMs = 2000) {
    if (this.controls) return; // Free Roam: the teacher drives the camera
    this.focus = { target: point.clone(), zoom: this.home.zoom * zoom, start: performance.now(), hold: holdMs };
  }

  label(text: string, className = "cw-tag"): CSS2DObject {
    const el = document.createElement("div");
    el.className = className;
    el.textContent = text;
    return new CSS2DObject(el);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.controls?.dispose();
    this.scene.traverse((o) => {
      if (o instanceof CSS2DObject) o.element.remove();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.domElement.remove();
  }

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);

    // Project the bounds' corners into camera space and size the view to fit them
    const b = this.bounds;
    const minY = b.minY ?? 0;
    const maxY = b.maxY ?? 4;
    const centre = new THREE.Vector3((b.minX + b.maxX) / 2, (minY + maxY) / 2, (b.minZ + b.maxZ) / 2);
    this.view.copy(this.cameraOffset);
    this.camera.position.copy(centre).add(this.view);
    this.camera.lookAt(centre);
    this.camera.updateMatrixWorld();
    const inv = this.camera.matrixWorldInverse;
    const aspect = w / h;
    const camera = this.camera;

    if (camera instanceof THREE.PerspectiveCamera) {
      // Move back just far enough for every corner to fit inside the view
      camera.aspect = aspect;
      const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const tanH = tanV * aspect;
      const origin = centre.clone().applyMatrix4(inv);
      let distance = 1;
      for (const x of [b.minX, b.maxX])
        for (const z of [b.minZ, b.maxZ])
          for (const y of [minY, maxY]) {
            const p = new THREE.Vector3(x, y, z).applyMatrix4(inv).sub(origin);
            distance = Math.max(distance, p.z + Math.abs(p.x) / tanH, p.z + Math.abs(p.y) / tanV);
          }
      this.view.multiplyScalar(distance * 1.03);
      camera.position.copy(centre).add(this.view);
      camera.lookAt(centre);
    } else {
      let halfW = 0;
      let halfH = 0;
      for (const x of [b.minX, b.maxX])
        for (const z of [b.minZ, b.maxZ])
          for (const y of [minY, maxY]) {
            const p = new THREE.Vector3(x, y, z).applyMatrix4(inv);
            halfW = Math.max(halfW, Math.abs(p.x));
            halfH = Math.max(halfH, Math.abs(p.y));
          }
      const halfHeight = Math.max(halfH, halfW / aspect) * 1.06;
      camera.left = -halfHeight * aspect;
      camera.right = halfHeight * aspect;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
    }
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    this.applyDepthFog();

    this.home = { target: centre, zoom: 1 };
    this.target.copy(centre);
    if (this.controls) {
      this.controls.target.copy(centre);
      if (camera instanceof THREE.PerspectiveCamera) {
        this.controls.minDistance = this.view.length() * 0.25;
        this.controls.maxDistance = this.view.length() * 1.4;
      }
    }
  }

  private updateCamera(now: number) {
    if (this.controls) return;
    let goalTarget = this.home.target;
    let goalZoom = this.home.zoom;
    if (this.focus) {
      const elapsed = now - this.focus.start;
      if (elapsed > this.focus.hold) this.focus = null;
      else {
        goalTarget = this.focus.target;
        goalZoom = this.focus.zoom;
      }
    }
    // Smooth glide towards the goal every frame
    const k = 1 - Math.pow(0.02, 1 / 60);
    this.target.lerp(goalTarget, k * 1.2);
    this.camera.zoom += (goalZoom - this.camera.zoom) * k * 1.2;
    this.camera.position
      .copy(this.view)
      .applyAxisAngle(UP, Math.sin(now / 9000) * this.driftAngle)
      .add(this.target);
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
  }

  private createControls() {
    if (!this.opts.roam) {
      this.controls = null;
      return;
    }
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.45;
    this.controls.enablePan = false; // always orbit the class, never wander off
  }

  private applyDepthFog() {
    if (!this.depthFog) return;
    const distance = this.view.length();
    this.scene.fog = new THREE.Fog(this.depthFog.color, distance + this.depthFog.near, distance + this.depthFog.far);
  }

  private countFps(now: number) {
    this.frames++;
    if (now - this.fpsClock >= 1000) {
      this.fps = Math.round((this.frames * 1000) / (now - this.fpsClock));
      this.frames = 0;
      this.fpsClock = now;
    }
  }
}

export { ease };
