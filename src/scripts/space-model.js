import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL_CONFIG = {
  station: {
    url: '/assets/cosmic/orbital-station.glb',
    rotation: [-1.08, -0.18, -0.18],
    drift: 0.075,
    targetSize: 2.65,
  },
  probe: {
    url: '/assets/cosmic/deep-space-probe.glb',
    rotation: [-0.1, 0.38, -0.08],
    drift: 0.085,
    targetSize: 2.2,
  },
};

function createViewer(host) {
  if (host.dataset.initialized === 'true') return;
  host.dataset.initialized = 'true';

  const variant = host.dataset.spaceModel;
  const config = MODEL_CONFIG[variant];
  const canvas = host.querySelector('canvas');
  if (!config || !canvas) return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 5.6);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  scene.add(new THREE.HemisphereLight(0xdde6f5, 0x090806, 2.8));
  const key = new THREE.DirectionalLight(0xffd6a2, 4.6);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7f9dc5, 2.2);
  rim.position.set(4, -2, -3);
  scene.add(rim);

  const root = new THREE.Group();
  root.rotation.set(...config.rotation);
  scene.add(root);
  let signal = null;

  if (variant === 'probe') {
    const signalMaterial = new THREE.MeshBasicMaterial({
      color: 0xf5b971,
      transparent: true,
      opacity: 0.08,
      depthTest: false,
    });
    const signalMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 12, 12),
      signalMaterial,
    );
    signalMesh.visible = false;
    signalMesh.renderOrder = 10;
    const signalLight = new THREE.PointLight(0xf5b971, 0, 1.8);
    signalLight.position.copy(signalMesh.position);
    root.add(signalMesh, signalLight);
    signal = { mesh: signalMesh, material: signalMaterial, light: signalLight };
  }

  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (width < 2 || height < 2) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  const draco = new DRACOLoader();
  draco.setDecoderPath('/vendor/draco/');
  draco.setDecoderConfig({ type: 'wasm' });

  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  let loaded = false;
  let visible = false;
  let disposed = false;
  let frame = 0;
  let last = performance.now();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const render = (now) => {
    if (disposed) return;
    frame = requestAnimationFrame(render);
    if (!loaded || !visible || document.hidden) {
      last = now;
      return;
    }
    const delta = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!reducedMotion) root.rotation.y += delta * config.drift;
    if (signal) {
      const pulse = reducedMotion ? 0.45 : Math.max(Math.sin(now * 0.0045), 0) ** 10;
      signal.material.opacity = 0.08 + pulse * 0.92;
      signal.light.intensity = pulse * 3.2;
      signal.mesh.scale.setScalar(0.72 + pulse * 1.45);
    }
    renderer.render(scene, camera);
  };
  frame = requestAnimationFrame(render);

  const observer = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible && loaded) renderer.render(scene, camera);
    },
    { rootMargin: '160px' },
  );
  observer.observe(host);

  loader.load(
    config.url,
    ({ scene: model }) => {
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const diameter = Math.max(size.x, size.y, size.z);
      model.position.sub(center);
      model.scale.setScalar(config.targetSize / diameter);
      model.traverse((child) => {
        if (!child.isMesh) return;
        child.frustumCulled = false;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
          if (!material) return;
          material.roughness = Math.max(material.roughness ?? 0.55, 0.38);
          material.metalness = Math.max(material.metalness ?? 0.25, 0.22);
        });
      });
      root.add(model);
      if (signal) {
        scene.updateMatrixWorld(true);
        const raycaster = new THREE.Raycaster();
        const samplePoints = [
          new THREE.Vector2(0.12, 0.02),
          new THREE.Vector2(0, 0),
          new THREE.Vector2(0.22, 0.08),
          new THREE.Vector2(-0.12, 0),
        ];
        const hit = samplePoints
          .flatMap((point) => {
            raycaster.setFromCamera(point, camera);
            return raycaster.intersectObject(model, true);
          })
          .sort((a, b) => a.distance - b.distance)[0];
        if (hit) {
          const surfacePoint = hit.point.clone();
          const towardCamera = camera.position.clone().sub(surfacePoint).normalize().multiplyScalar(0.025);
          signal.mesh.position.copy(root.worldToLocal(surfacePoint.add(towardCamera)));
          signal.light.position.copy(signal.mesh.position);
          signal.mesh.visible = true;
          host.dataset.signalAttached = 'true';
        }
      }
      loaded = true;
      host.classList.add('ready');
      host.dispatchEvent(new CustomEvent('space-model:ready', { detail: { variant } }));
      renderer.render(scene, camera);
    },
    undefined,
    (error) => {
      host.classList.add('failed');
      host.dispatchEvent(
        new CustomEvent('space-model:error', {
          detail: { variant, message: String(error?.message || error) },
        }),
      );
      console.error(`Failed to load ${variant} model:`, error);
    },
  );

  window.addEventListener(
    'pagehide',
    () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      draco.dispose();
      renderer.dispose();
    },
    { once: true },
  );
}

document.querySelectorAll('[data-space-model]').forEach(createViewer);
