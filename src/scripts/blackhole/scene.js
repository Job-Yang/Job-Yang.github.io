import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { BlackHoleSimulation } from './blackhole.js';
import { defaultConfig } from './default-config.js';

const canvas = document.querySelector('#black-hole-canvas');

if (canvas) {
  const deepFieldTexture = new THREE.TextureLoader().load(
    '/images/cosmic/home-deep-field.webp',
  );
  deepFieldTexture.colorSpace = THREE.SRGBColorSpace;
  deepFieldTexture.wrapS = THREE.RepeatWrapping;
  deepFieldTexture.wrapT = THREE.ClampToEdgeWrapping;

  const config = {
    ...defaultConfig,
    deepFieldTexture,
    deepFieldBrightness: 0.2,
    diskInnerRadius: 5.2,
    diskOuterRadius: 22,
    diskTemperature: 8,
    temperatureFalloff: 0.35,
    diskBrightness: 2.2,
    diskDensity: 0.65,
    dopplerStrength: 5,
    diskRotationSpeed: -13,
    diskEdgeSoftnessInner: 0.05,
    diskEdgeSoftnessOuter: 0.06,
    bloomStrength: 0.55,
    bloomThreshold: 0.5,
    turbulenceBrightness: -0.06,
    raySteps: 48,
    starsEnabled: true,
    starDensity: 0.085,
    starSize: 1.1,
    starBrightness: 0.32,
    lensingAnchorsEnabled: true,
    lensingAnchorBrightness: 0.26,
    nebulaEnabled: true,
    nebula1Scale: 2.4,
    nebula1Density: 0.38,
    nebula1Brightness: 0.025,
    nebula1Color: '#1a1511',
    nebula2Scale: 5,
    nebula2Density: 0.2,
    nebula2Brightness: 0.018,
    nebula2Color: '#171318',
  };
  const presets = {
    saver: {
      preset: 'saver',
      clarity: 0.75,
      fps: 24,
      precision: 20,
      lensing: 2,
      bloom: 0.25,
      detail: 0.3,
    },
    default: {
      preset: 'default',
      clarity: 1.25,
      fps: 30,
      precision: 45,
      lensing: 2.4,
      bloom: 0.55,
      detail: 0.6,
    },
    cinema: {
      preset: 'cinema',
      clarity: 1.5,
      fps: 45,
      precision: 72,
      lensing: 2.8,
      bloom: 0.82,
      detail: 0.82,
    },
    extreme: {
      preset: 'extreme',
      clarity: 2,
      fps: 60,
      precision: 100,
      lensing: 2.8,
      bloom: 1.05,
      detail: 1,
    },
  };
  let settings = { ...presets.default, paused: false };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  camera.position.set(0, -5, 20);
  camera.lookAt(0, 0, 0);
  scene.add(camera);

  const renderer = new THREE.WebGPURenderer({ antialias: true, canvas });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(settings.clarity);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const simulation = new BlackHoleSimulation(scene, config);
  simulation.createBlackHole();

  const shipRoot = new THREE.Group();
  const shipSpin = new THREE.Group();
  const shipAxis = new THREE.Vector3(0, 0, 1);
  const shipTarget = new THREE.Vector3();
  const shipDirection = new THREE.Vector3();
  const shipWorldAxis = new THREE.Vector3();
  const shipRedshift = new THREE.Color(0x9f6848);
  const shipMaterials = [];
  const shipLensImages = [];
  shipRoot.add(shipSpin);
  camera.add(shipRoot);
  shipRoot.visible = false;

  const fill = new THREE.HemisphereLight(0xe8edf6, 0x080706, 2.2);
  const rim = new THREE.DirectionalLight(0xffd5a0, 5.5);
  rim.position.set(-4, 3, 5);
  camera.add(fill, rim);

  const debug = {
    loaded: false,
    error: null,
    compressedBytes: 1549744,
    requestedAt: performance.now(),
    loadedAt: null,
    firstOnScreenAt: null,
  };
  window.__shipDebug = debug;

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(
    '/assets/endurance.glb',
    ({ scene: model }) => {
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const diameter = Math.max(size.x, size.y, size.z);

      model.position.sub(center);
      model.scale.setScalar(2.15 / diameter);
      model.traverse((child) => {
        if (!child.isMesh) return;
        child.frustumCulled = false;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
          if (!material) return;
          material.roughness = Math.max(material.roughness ?? 0.65, 0.48);
          material.metalness = Math.max(material.metalness ?? 0.25, 0.18);
          if (!shipMaterials.includes(material)) {
            material.userData.shipBaseOpacity = material.opacity;
            material.userData.shipBaseColor = material.color?.clone();
            material.userData.shipBaseEmissive = material.emissive?.clone();
            material.userData.shipBaseEmissiveIntensity = material.emissiveIntensity ?? 1;
            material.transparent = true;
            material.needsUpdate = true;
            shipMaterials.push(material);
          }
        });
      });

      shipSpin.add(model);

      [
        { x: -0.28, y: 0.12, strength: 0.2 },
        { x: 0.22, y: -0.1, strength: 0.12 },
      ].forEach(({ x, y, strength }) => {
        const image = new THREE.Group();
        const clone = model.clone(true);
        const materials = [];
        clone.traverse((child) => {
          if (!child.isMesh) return;
          const source = Array.isArray(child.material) ? child.material : [child.material];
          const cloned = source.map((material) => {
            const next = material.clone();
            next.transparent = true;
            next.depthWrite = false;
            next.opacity = 0;
            next.needsUpdate = true;
            materials.push(next);
            return next;
          });
          child.material = Array.isArray(child.material) ? cloned : cloned[0];
          child.renderOrder = 4;
        });
        image.add(clone);
        image.position.set(x, y, 0.08);
        image.visible = false;
        shipSpin.add(image);
        shipLensImages.push({ group: image, materials, x, y, strength });
      });

      shipRoot.visible = true;
      debug.loaded = true;
      debug.loadedAt = performance.now();
      debug.loadDuration = Number((debug.loadedAt - debug.requestedAt).toFixed(1));
      shipStartedAt = debug.loadedAt;
      debug.bounds = size.toArray();
    },
    undefined,
    (error) => {
      debug.error = String(error?.message || error);
      console.error('Endurance model failed to load:', error);
    },
  );

  let postProcessing;
  let bloomPass;
  let scrollProgress = 0;
  let elapsed = 0;
  let shipStartedAt = null;
  let last = performance.now();
  let accumulated = 0;
  let targetFrameDuration = 1000 / settings.fps;
  let pageVisible = !document.hidden;
  let renderedFrames = 0;
  let metricsStartedAt = performance.now();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  settings.paused = reducedMotion;

  const getState = () => ({ ...settings });

  const emitMetrics = (now = performance.now()) => {
    const elapsedMs = now - metricsStartedAt;
    if (elapsedMs < 500) return;
    const fps = settings.paused ? 0 : (renderedFrames * 1000) / elapsedMs;
    renderedFrames = 0;
    metricsStartedAt = now;
    window.dispatchEvent(
      new CustomEvent('blackhole:metrics', {
        detail: {
          fps,
          resolution: `${canvas.width}×${canvas.height}`,
          status: settings.paused ? '已暂停' : '实时',
        },
      }),
    );
  };

  const applySettings = (next) => {
    settings = { ...settings, ...next };
    targetFrameDuration = 1000 / settings.fps;

    renderer.setPixelRatio(settings.clarity);
    renderer.setSize(window.innerWidth, window.innerHeight);
    simulation.onResize(window.innerWidth, window.innerHeight);

    const precision = THREE.MathUtils.clamp(settings.precision / 100, 0, 1);
    const detail = THREE.MathUtils.clamp(settings.detail, 0, 1);
    const stepSize = THREE.MathUtils.lerp(1.35, 0.55, precision);
    simulation.updateUniforms({
      stepSize,
      gravitationalLensing: settings.lensing,
      starBrightness: THREE.MathUtils.lerp(0.12, 0.36, detail),
      nebula1Brightness: THREE.MathUtils.lerp(0.004, 0.038, detail),
      nebula2Brightness: THREE.MathUtils.lerp(0.003, 0.028, detail),
    });

    if (bloomPass) bloomPass.strength.value = settings.bloom;
    debug.settings = getState();
    debug.effective = {
      pixelRatio: renderer.getPixelRatio(),
      targetFps: settings.fps,
      stepSize: Number(stepSize.toFixed(3)),
      lensing: settings.lensing,
      bloom: settings.bloom,
      detail: settings.detail,
    };
    return getState();
  };

  const applyPreset = (name) => applySettings(presets[name] ?? presets.default);
  const reset = () => applySettings({ ...presets.default, paused: false });
  const togglePause = () => {
    settings.paused = !settings.paused;
    accumulated = 0;
    last = performance.now();
    debug.settings = getState();
    return getState();
  };

  const syncScroll = () => {
    if (plunge.active) return;
    const range = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    scrollProgress = Math.min(Math.max(window.scrollY / range, 0), 1);
    document.documentElement.style.setProperty(
      '--space-fade',
      String(Math.max((scrollProgress - 0.68) / 0.32, 0)),
    );
  };

  // Programmatic "dive into the black hole" used for page transitions. Drives the
  // same camera plunge that scrolling does, but on a timer, then fades to black.
  const plunge = { active: false, start: 0, duration: 760, from: 0, resolve: null };

  const runPlunge = (now) => {
    const t = Math.min((now - plunge.start) / plunge.duration, 1);
    // easeInQuart — hangs briefly, then snaps hard into the core for impact.
    const eased = t * t * t * t;
    scrollProgress = Math.min(plunge.from + (1 - plunge.from) * eased, 1);
    // Let the head-on dive fill the frame with the core, then land on black.
    const dark = THREE.MathUtils.smoothstep(t, 0.86, 1);
    document.documentElement.style.setProperty('--space-fade', String(1 + dark * 2));
    document.documentElement.style.setProperty('--plunge-black', String(dark));
    if (t >= 1) {
      plunge.active = false;
      const done = plunge.resolve;
      plunge.resolve = null;
      if (done) done();
    }
  };

  const startPlunge = (duration = 760) =>
    new Promise((resolve) => {
      if (reducedMotion || settings.paused) {
        resolve();
        return;
      }
      plunge.active = true;
      plunge.start = performance.now();
      plunge.duration = duration;
      plunge.from = scrollProgress;
      plunge.resolve = resolve;
    });

  window.blackHoleControls = {
    applyPreset,
    applySettings,
    getState,
    reset,
    togglePause,
    plunge: startPlunge,
  };

  const updateCamera = (delta) => {
    elapsed += delta;
    const approach = 1 - Math.exp(-elapsed * 0.16);
    const fall = scrollProgress ** 2 * (3 - 2 * scrollProgress);
    // During a transition dive, swing the camera to face the core head-on,
    // kill the stylised drift/tilt, and push it right up to the event horizon
    // so the central black grows and swallows the frame — "falling into" the
    // black hole rather than "flying past" it.
    const dive = plunge.active ? THREE.MathUtils.smoothstep(scrollProgress, 0.42, 1) : 0;
    const straighten = 1 - dive;
    // Drive the camera all the way to (and slightly past) the event horizon so
    // the central black fills the frame — a "slamming into" impact, not a flyby.
    const distance = Math.max(31 - approach * 7 - fall * 16 - dive * (30 - fall * 8), 0.28);
    const y = (-1.15 - approach * 0.45 - fall * 4.4) * straighten;
    const drift = Math.sin(elapsed * 0.05) * 1.8 * straighten;
    const angle = (0.12 + elapsed * 0.005) * straighten;

    camera.position.set(
      Math.sin(angle) * distance + drift,
      y,
      Math.cos(angle) * distance,
    );
    camera.lookAt(0, -scrollProgress * 2.5 * straighten, 0);
    camera.rotateY(-0.5 * straighten);
    camera.rotateX(0.1 * straighten);
  };

  const updateShip = (delta) => {
    if (!debug.loaded) return;

    if (shipStartedAt === null) shipStartedAt = performance.now();
    const cycleDuration = 28;
    const shipElapsed = (performance.now() - shipStartedAt) / 1000;
    const cyclePhase = (shipElapsed % cycleDuration) / cycleDuration;
    const autoPhase = Math.min(cyclePhase / 0.92, 1);
    const autoApproach = autoPhase;
    const scrollFall = scrollProgress ** 2 * (3 - 2 * scrollProgress);
    const flight = Math.min(Math.max(autoApproach, scrollFall), 1);
    // Keep the ship readable through the bright accretion disk. It only
    // disappears during the final approach into the black core.
    const fade = THREE.MathUtils.smoothstep(flight, 0.88, 1);
    const narrow = camera.aspect < 1;
    const targetNdcX = narrow ? 0.38 : 0.4;
    const targetNdcY = narrow ? 0.12 : 0.14;
    const startNdcX = narrow ? 0.72 : -0.16;
    // Start just below the viewport and move linearly for the whole approach.
    // At the 28s cycle length this crosses the lower edge after about one second.
    const startNdcY = -1.04;
    const ndcX = THREE.MathUtils.lerp(startNdcX, targetNdcX, flight);
    const ndcY = THREE.MathUtils.lerp(startNdcY, targetNdcY, flight);
    const z = THREE.MathUtils.lerp(-7.2, -36, flight);
    const halfHeight = Math.abs(z) * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));

    shipRoot.position.set(ndcX * halfHeight * camera.aspect, ndcY * halfHeight, z);

    const targetZ = -80;
    const targetHalfHeight =
      Math.abs(targetZ) * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    shipTarget.set(
      targetNdcX * targetHalfHeight * camera.aspect,
      targetNdcY * targetHalfHeight,
      targetZ,
    );
    shipDirection.copy(shipTarget).sub(shipRoot.position).normalize();
    shipRoot.quaternion.setFromUnitVectors(shipAxis, shipDirection);

    shipSpin.rotation.z += delta * (0.72 + flight * 4.8);
    const scale = (narrow ? 0.38 : 1) * THREE.MathUtils.lerp(1, 0.68, fade);
    const opacity = 1 - fade;
    const lensStrength =
      THREE.MathUtils.smoothstep(flight, 0.5, 0.76) *
      (1 - THREE.MathUtils.smoothstep(flight, 0.9, 1));
    shipSpin.scale.setScalar(scale);
    shipMaterials.forEach((material) => {
      material.opacity = material.userData.shipBaseOpacity * opacity;
      if (material.color && material.userData.shipBaseColor) {
        material.color
          .copy(material.userData.shipBaseColor)
          .lerp(shipRedshift, fade * 0.62)
          .multiplyScalar(THREE.MathUtils.lerp(1, 0.38, fade));
      }
      if (material.emissive && material.userData.shipBaseEmissive) {
        material.emissive.copy(material.userData.shipBaseEmissive);
        material.emissiveIntensity =
          material.userData.shipBaseEmissiveIntensity * THREE.MathUtils.lerp(1, 0.2, fade);
      }
    });
    shipLensImages.forEach(({ group, materials, x, y, strength }, index) => {
      group.visible = lensStrength > 0.02 && opacity > 0.03;
      group.position.x = x * THREE.MathUtils.lerp(0.45, 1.35, lensStrength);
      group.position.y = y * THREE.MathUtils.lerp(0.45, 1.2, lensStrength);
      group.rotation.z = (index === 0 ? -1 : 1) * lensStrength * 0.14;
      materials.forEach((material) => {
        material.opacity = lensStrength * strength * opacity;
        if (material.color) material.color.copy(shipRedshift).multiplyScalar(0.72);
      });
    });
    shipRoot.visible = opacity > 0.01;

    shipWorldAxis.copy(shipAxis).applyQuaternion(shipRoot.quaternion);
    debug.flight = Number(flight.toFixed(3));
    debug.cyclePhase = Number(cyclePhase.toFixed(3));
    debug.screenPosition = [Number(ndcX.toFixed(3)), Number(ndcY.toFixed(3))];
    debug.opacity = Number(opacity.toFixed(3));
    debug.scale = Number(scale.toFixed(3));
    debug.lensStrength = Number(lensStrength.toFixed(3));
    debug.rotation = Number(shipSpin.rotation.z.toFixed(3));
    debug.axisAlignment = Number(shipWorldAxis.dot(shipDirection).toFixed(6));
    debug.visible = shipRoot.visible;
    if (debug.firstOnScreenAt === null && ndcY > -1) {
      debug.firstOnScreenAt = performance.now();
      debug.timeFromLoadedToOnScreen = Number((debug.firstOnScreenAt - debug.loadedAt).toFixed(1));
    }
  };

  const animate = () => {
    requestAnimationFrame(animate);
    const now = performance.now();
    let delta = (now - last) / 1000;
    last = now;
    accumulated += delta * 1000;
    emitMetrics(now);
    if (accumulated < targetFrameDuration || !pageVisible || settings.paused) return;
    accumulated = 0;
    delta = Math.min(delta, 0.05);

    if (plunge.active) runPlunge(now);
    updateCamera(delta);
    updateShip(delta);
    simulation.update(delta, camera);
    postProcessing.render();
    renderedFrames += 1;
  };

  document.addEventListener('visibilitychange', () => {
    pageVisible = !document.hidden;
  });
  // If the page is restored from bfcache after a forward plunge, the black veil
  // variables are still maxed out — clear them so the page isn't left blacked out.
  const clearPlunge = () => {
    plunge.active = false;
    plunge.resolve = null;
    document.documentElement.style.setProperty('--plunge-black', '0');
    syncScroll();
  };
  window.addEventListener('pageshow', clearPlunge);
  clearPlunge();
  window.addEventListener('scroll', syncScroll, { passive: true });
  window.addEventListener(
    'resize',
    () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      simulation.onResize(window.innerWidth, window.innerHeight);
      syncScroll();
    },
    { passive: true },
  );
  syncScroll();

  renderer
    .init()
    .then(() => {
      postProcessing = new THREE.PostProcessing(renderer);
      const scenePass = pass(scene, camera);
      const color = scenePass.getTextureNode();
      bloomPass = bloom(color);
      bloomPass.threshold.value = config.bloomThreshold;
      bloomPass.strength.value = config.bloomStrength;
      bloomPass.radius.value = config.bloomRadius;
      postProcessing.outputNode = color.add(bloomPass);

      applySettings(settings);
      updateCamera(0.01);
      updateShip(0.01);
      simulation.update(0.01, camera);
      postProcessing.render();
      renderedFrames += 1;
      if (reducedMotion) shipRoot.visible = false;
      window.dispatchEvent(new CustomEvent('blackhole:ready', { detail: getState() }));
      animate();
    })
    .catch((error) => {
      console.error('WebGPU init failed:', error);
      document.body.classList.add('no-webgpu');
      window.dispatchEvent(new CustomEvent('blackhole:unavailable'));
    });
}
