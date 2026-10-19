"use client";

import { useEffect, useRef } from "react";
import { groceryModelFor } from "@/lib/grocery-models";

export type CartPassenger = { id: string; name: string };

type Vec3 = { x: number; y: number; z: number };
type Drop = { object: { position: Vec3 }; from: Vec3; to: Vec3; start: number };

const dropMs = 420;

/** Cubic bezier (0.23, 1, 0.32, 1), the same ease-out as the rest of the app. */
function easeOut(t: number) {
  const [x1, y1, x2, y2] = [0.23, 1, 0.32, 1];
  let u = t;
  for (let i = 0; i < 6; i++) {
    const x = 3 * (1 - u) ** 2 * u * x1 + 3 * (1 - u) * u ** 2 * x2 + u ** 3;
    const dx = 3 * (1 - u) ** 2 * x1 + 6 * (1 - u) * u * (x2 - x1) + 3 * u ** 2 * (1 - x2);
    if (Math.abs(dx) < 1e-4) break;
    u = Math.min(1, Math.max(0, u - (x - t) / dx));
  }
  return 3 * (1 - u) ** 2 * u * y1 + 3 * (1 - u) * u ** 2 * y2 + u ** 3;
}

function slotAt(index: number): Vec3 {
  const column = index % 3;
  const layer = Math.floor(index / 3);
  return {
    x: 0.08,
    y: 0.4 + layer * 0.12,
    z: -0.12 + column * 0.14,
  };
}

/**
 * The clay cart on the page background. Matching groceries drop into the basket
 * and stay there until they are checked off the list.
 */
export function CartModel({ items }: { items: CartPassenger[] }) {
  const host = useRef<HTMLDivElement>(null);
  const itemsRef = useRef(items);
  const syncRef = useRef<(next: CartPassenger[]) => void>(() => {});

  useEffect(() => {
    itemsRef.current = items;
    syncRef.current(items);
  }, [items]);

  useEffect(() => {
    const parent = host.current;
    if (!parent) return;
    let alive = true;
    let frame = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const boot = async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      if (!alive || !parent) return;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.touchAction = "pan-y";
      parent.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 20);
      scene.add(new THREE.AmbientLight(0xffffff, 0.9));
      const key = new THREE.DirectionalLight(0xfff4e8, 1.45);
      key.position.set(2.4, 3.2, 1.6);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 0.35);
      fill.position.set(-2, 1.4, -1.2);
      scene.add(fill);

      const shadow = shadowBlot(THREE);
      scene.add(shadow);

      const loader = new GLTFLoader();
      const templates = new Map<string, Promise<import("three").Object3D>>();
      const placed = new Map<string, import("three").Object3D>();
      const slots = new Map<string, number>();
      const drops: Drop[] = [];

      const load = (src: string) => {
        let pending = templates.get(src);
        if (!pending) {
          pending = new Promise((resolve, reject) => {
            loader.load(src, (gltf) => resolve(gltf.scene), undefined, reject);
          });
          templates.set(src, pending);
        }
        return pending;
      };

      const resize = () => {
        const width = parent.clientWidth || 1;
        const height = parent.clientHeight || 1;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(parent);

      const cart = await load("/models/cart.glb");
      if (!alive) return;
      scene.add(cart);
      const bounds = new THREE.Box3().setFromObject(cart);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const distance = Math.max(size.y, size.z) / (2 * Math.tan((28 * Math.PI) / 360)) * 1.28;
      camera.position.set(center.x + distance, center.y + size.y * 0.02, center.z);
      camera.lookAt(center.x, center.y * 0.92, center.z);
      shadow.position.set(center.x, bounds.min.y + 0.004, center.z);
      resize();

      const freeSlot = () => {
        const taken = new Set(slots.values());
        let index = 0;
        while (taken.has(index)) index += 1;
        return index;
      };

      const sync = (next: CartPassenger[]) => {
        const wanted = new Map<string, string>();
        for (const item of next) {
          const src = groceryModelFor(item.name);
          if (src) wanted.set(item.id, src);
        }
        for (const [id, object] of placed) {
          if (wanted.has(id)) continue;
          scene.remove(object);
          placed.delete(id);
          slots.delete(id);
        }
        for (const [id, src] of wanted) {
          if (slots.has(id)) continue;
          const slot = freeSlot();
          slots.set(id, slot);
          const to = slotAt(slot);
          load(src)
            .then((template) => {
              if (!alive || !slots.has(id) || placed.has(id)) return;
              const object = template.clone(true);
              const holder = new THREE.Group();
              holder.add(object);
              restOnFloor(THREE, object);
              scene.add(holder);
              placed.set(id, holder);
              if (reduce) {
                holder.position.set(to.x, to.y, to.z);
                return;
              }
              const from = { x: to.x, y: to.y + 0.42, z: to.z };
              holder.position.set(from.x, from.y, from.z);
              drops.push({ object: holder, from, to, start: performance.now() });
            })
            .catch(() => {
              slots.delete(id);
            });
        }
      };

      syncRef.current = sync;
      sync(itemsRef.current);

      const tick = (now: number) => {
        for (let i = drops.length - 1; i >= 0; i--) {
          const drop = drops[i];
          const t = Math.min(1, (now - drop.start) / dropMs);
          const eased = easeOut(t);
          const arc = Math.sin(Math.PI * t) * 0.08;
          drop.object.position.set(
            drop.from.x + (drop.to.x - drop.from.x) * eased,
            drop.from.y + (drop.to.y - drop.from.y) * eased + arc,
            drop.from.z + (drop.to.z - drop.from.z) * eased,
          );
          if (t === 1) drops.splice(i, 1);
        }
        renderer.render(scene, camera);
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);

      return () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        syncRef.current = () => {};
        renderer.dispose();
        renderer.domElement.remove();
      };
    };

    let shutdown = () => {};
    boot().then((done) => {
      if (!alive) done?.();
      else if (done) shutdown = done;
    });

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      shutdown();
    };
  }, []);

  return <div ref={host} className="h-full w-full" />;
}

function restOnFloor(THREE: typeof import("three"), object: import("three").Object3D) {
  object.position.set(0, 0, 0);
  object.scale.set(1, 1, 1);
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z, 0.0001);
  object.scale.setScalar(0.2 / span);
  object.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(object);
  const center = fitted.getCenter(new THREE.Vector3());
  object.position.set(-center.x, -fitted.min.y, -center.z);
}

function shadowBlot(THREE: typeof import("three")) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(64, 32, 4, 64, 32, 60);
    gradient.addColorStop(0, "rgba(60, 50, 40, 0.28)");
    gradient.addColorStop(1, "rgba(60, 50, 40, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 64);
  }
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 0.42),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}
