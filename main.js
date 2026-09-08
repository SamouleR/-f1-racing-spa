import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============================================================
// GLOBALS
// ============================================================
let renderer, camera, selectionScene, racingScene;
let selectionControls;
let currentScene = 'loading';
let carModels = {};
let circuitModel = null;
let selectedCar = null;
let selectedSection = null;

// Portfolio Content Data
const portfolioData = {
  'mclaren': {
    title: 'Mon Parcours',
    content: '<p>Développeur passionné par le web et la 3D, j\'ai commencé mon aventure il y a 3 ans.</p><ul><li>Expérience en agence web</li><li>Maîtrise de JavaScript, React, Three.js</li><li>Création d\'expériences immersives</li></ul>'
  },
  'ferrari': {
    title: 'Mes Projets',
    content: '<p>Voici quelques-unes de mes réalisations techniques :</p><ul><li><strong>F1 Racing 3D</strong> : Ce portfolio interactif en WebGL</li><li><strong>E-commerce</strong> : Plateforme complète avec panier et paiement</li><li><strong>Dashboard Admin</strong> : Interface de gestion de données complexe</li></ul>'
  },
  'redbull': {
    title: 'Me Contacter',
    content: '<p>Vous cherchez un développeur créatif pour votre prochain projet ? Discutons-en !</p><ul><li><strong>Email</strong>: contact@samuel-portfolio.com</li><li><strong>GitHub</strong>: github.com/SamouleR</li><li><strong>LinkedIn</strong>: /in/samuel-dev</li></ul>'
  }
};
let selectedCarModel = null;

// Car physics
const carState = {
  speed: 0,
  maxSpeed: 320,
  acceleration: 80,
  braking: 120,
  friction: 30,
  turnSpeed: 0,
  maxTurnSpeed: 2.2,
  turnAcceleration: 4.0,
  turnFriction: 5.0,
  position: new THREE.Vector3(0, 0, 0),
  rotation: 0,
  gear: 'N',
};

// Input state
const keys = {};

// Camera mode
let cameraMode = 'cockpit'; // 'cockpit', 'chase', 'top'
let cameraOffset = new THREE.Vector3(0, 2.0, 0.3); // cockpit offset
let startPosition = new THREE.Vector3(0, 50, 0); // stored start position

// ============================================================
// INITIALIZATION
// ============================================================
function init() {
  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('game-canvas'),
    antialias: true,
    alpha: false,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);

  // Setup scenes
  setupSelectionScene();
  setupRacingScene();

  // Event listeners
  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', (e) => { keys[e.code] = true; });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  // Load models
  loadAllModels();

  // Start render loop
  animate();
}

// ============================================================
// SELECTION SCENE
// ============================================================
function setupSelectionScene() {
  selectionScene = new THREE.Scene();
  selectionScene.background = new THREE.Color(0x080810);
  selectionScene.fog = new THREE.Fog(0x080810, 30, 80);

  // Ambient light
  const ambient = new THREE.AmbientLight(0x404060, 0.8);
  selectionScene.add(ambient);

  // Key light
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
  keyLight.position.set(10, 15, 10);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  selectionScene.add(keyLight);

  // Fill light
  const fillLight = new THREE.DirectionalLight(0x4466ff, 1.0);
  fillLight.position.set(-10, 8, -5);
  selectionScene.add(fillLight);

  // Rim light
  const rimLight = new THREE.DirectionalLight(0xff4444, 0.8);
  rimLight.position.set(0, 5, -15);
  selectionScene.add(rimLight);

  // Ground
  const groundGeo = new THREE.PlaneGeometry(200, 200);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x111118,
    roughness: 0.8,
    metalness: 0.2,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  selectionScene.add(ground);

  // Grid helper
  const grid = new THREE.GridHelper(100, 100, 0x222233, 0x151520);
  selectionScene.add(grid);

  // Spotlights for each car position
  const positions = [[-8, 0, 0], [0, 0, 0], [8, 0, 0]];
  positions.forEach(pos => {
    const spot = new THREE.SpotLight(0xffffff, 40, 20, Math.PI / 6, 0.5, 1);
    spot.position.set(pos[0], 10, pos[2]);
    spot.target.position.set(pos[0], 0, pos[2]);
    selectionScene.add(spot);
    selectionScene.add(spot.target);
  });

  // Camera position for selection
  camera.position.set(0, 6, 16);
  camera.lookAt(0, 1, 0);

  // Orbit controls for selection view
  selectionControls = new OrbitControls(camera, renderer.domElement);
  selectionControls.enableDamping = true;
  selectionControls.dampingFactor = 0.05;
  selectionControls.target.set(0, 1, 0);
  selectionControls.maxPolarAngle = Math.PI / 2.1;
  selectionControls.minDistance = 8;
  selectionControls.maxDistance = 25;
  selectionControls.enablePan = false;
}

// ============================================================
// RACING SCENE
// ============================================================
function setupRacingScene() {
  racingScene = new THREE.Scene();
  racingScene.background = new THREE.Color(0x87CEEB);

  // Sky gradient
  const skyGeo = new THREE.SphereGeometry(5000, 32, 32);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(0x4488cc) },
      bottomColor: { value: new THREE.Color(0xc8e6ff) },
      offset: { value: 20 },
      exponent: { value: 0.4 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + offset).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }
    `,
    side: THREE.BackSide,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  racingScene.add(sky);

  // Sun light
  const sun = new THREE.DirectionalLight(0xfff5e6, 3);
  sun.position.set(100, 80, 50);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.far = 500;
  sun.shadow.camera.left = -100;
  sun.shadow.camera.right = 100;
  sun.shadow.camera.top = 100;
  sun.shadow.camera.bottom = -100;
  racingScene.add(sun);

  // Ambient
  const ambient = new THREE.AmbientLight(0x88aacc, 1.0);
  racingScene.add(ambient);

  // Hemisphere light
  const hemi = new THREE.HemisphereLight(0x88bbff, 0x445522, 0.8);
  racingScene.add(hemi);

  // Fallback ground (in case circuit has no ground)
  const groundGeo = new THREE.PlaneGeometry(5000, 5000);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x2d5a27,
    roughness: 0.9,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  racingScene.add(ground);
}

// ============================================================
// MODEL LOADING
// ============================================================
function loadAllModels() {
  const loader = new GLTFLoader();
  const progressEl = document.getElementById('progress-bar');
  const textEl = document.getElementById('loading-text');

  const models = [
    { name: 'mclaren', path: '/models/mclaren.glb', label: 'McLaren MCL35M' },
    { name: 'ferrari', path: '/models/ferrari.glb', label: 'Ferrari SF90' },
    { name: 'redbull', path: '/models/redbull.glb', label: 'Red Bull RB20' },
    { name: 'circuit', path: '/models/spa.glb', label: 'Circuit de Spa-Francorchamps' },
  ];

  let loaded = 0;
  const total = models.length;

  models.forEach((modelInfo) => {
    textEl.textContent = `Chargement : ${modelInfo.label}...`;

    loader.load(
      modelInfo.path,
      (gltf) => {
        const model = gltf.scene;

        if (modelInfo.name === 'circuit') {
          circuitModel = model;
        } else {
          carModels[modelInfo.name] = model;
        }

        loaded++;
        const progress = (loaded / total) * 100;
        progressEl.style.width = progress + '%';
        textEl.textContent = `Chargé : ${modelInfo.label} (${loaded}/${total})`;

        if (loaded === total) {
          onAllModelsLoaded();
        }
      },
      (xhr) => {
        if (xhr.total) {
          const fileProgress = (xhr.loaded / xhr.total) * 100;
          textEl.textContent = `Chargement : ${modelInfo.label} (${Math.round(fileProgress)}%)`;
        }
      },
      (error) => {
        console.error(`Error loading ${modelInfo.name}:`, error);
        textEl.textContent = `Erreur : ${modelInfo.label}`;
        loaded++;
        if (loaded === total) {
          onAllModelsLoaded();
        }
      }
    );
  });
}

function onAllModelsLoaded() {
  console.log('All models loaded!');
  console.log('Car models:', Object.keys(carModels));
  console.log('Circuit:', circuitModel ? 'loaded' : 'missing');

  // Normalize and place cars in selection scene
  placeSelectionCars();

  // Transition to selection screen
  setTimeout(() => {
    document.getElementById('loading-screen').classList.add('fade-out');
    setTimeout(() => {
      document.getElementById('loading-screen').classList.add('hidden');
      document.getElementById('selection-screen').classList.remove('hidden');
      document.getElementById('selection-screen').classList.add('fade-in');
      currentScene = 'selection';
      setupCarSelection();
    }, 800);
  }, 500);
}

function normalizeModel(model, targetSize = 4) {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = targetSize / maxDim;
  model.scale.multiplyScalar(scale);

  // Recalculate box after scale
  box.setFromObject(model);
  const center = new THREE.Vector3();
  box.getCenter(center);
  model.position.sub(center);
  model.position.y -= box.min.y - model.position.y; // Place on ground

  // Recenter at ground level
  box.setFromObject(model);
  model.position.y -= box.min.y;

  return { scale, size, box };
}

function placeSelectionCars() {
  const positions = {
    mclaren: new THREE.Vector3(-8, 0, 0),
    ferrari: new THREE.Vector3(0, 0, 0),
    redbull: new THREE.Vector3(8, 0, 0),
  };

  Object.entries(carModels).forEach(([name, model]) => {
    const container = new THREE.Group();
    container.add(model);
    normalizeModel(model, 5);

    // Adjust so car sits on ground
    const box = new THREE.Box3().setFromObject(model);
    model.position.y = -box.min.y;

    container.position.copy(positions[name]);
    container.userData.name = name;

    // Enable shadows on car
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    selectionScene.add(container);
  });
}

// ============================================================
// CAR SELECTION LOGIC
// ============================================================
function setupCarSelection() {
  const cards = document.querySelectorAll('.car-card');
  const buttons = document.querySelectorAll('.select-btn');

  // Hover highlighting
  cards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      const carName = card.dataset.car;
      highlightCar(carName);
    });

    card.addEventListener('mouseleave', () => {
      resetCarHighlights();
    });
  });

  // Selection
  buttons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.car-card');
      const carName = card.dataset.car;
      selectCar(carName);
    });
  });

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const carName = card.dataset.car;
      selectCar(carName);
    });
  });
}

function highlightCar(carName) {
  selectionScene.children.forEach(child => {
    if (child.isGroup && child.userData.name) {
      if (child.userData.name === carName) {
        child.scale.set(1.1, 1.1, 1.1);
      } else {
        child.scale.set(0.9, 0.9, 0.9);
        child.traverse(c => {
          if (c.isMesh && c.material) {
            const mats = Array.isArray(c.material) ? c.material : [c.material];
            mats.forEach(m => { m.opacity = 0.5; m.transparent = true; });
          }
        });
      }
    }
  });
}

function resetCarHighlights() {
  selectionScene.children.forEach(child => {
    if (child.isGroup && child.userData.name) {
      child.scale.set(1, 1, 1);
      child.traverse(c => {
        if (c.isMesh && c.material) {
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          mats.forEach(m => { m.opacity = 1; m.transparent = false; });
        }
      });
    }
  });
}

function selectCar(carName) {
  selectedCar = carName;
  selectedSection = carName;
  console.log('Selected section:', carName);

  // Transition animation
  document.getElementById('selection-screen').classList.add('fade-out');

  // Inject portfolio content
  const data = portfolioData[carName];
  if (data) {
    document.getElementById('portfolio-title').innerHTML = data.title;
    document.getElementById('portfolio-content').innerHTML = data.content;
  }

  setTimeout(() => {
    document.getElementById('selection-screen').classList.add('hidden');
    startRacing();
  }, 800);
}

// ============================================================
// RACING MODE
// ============================================================
function startRacing() {
  currentScene = 'racing';

  // Disable orbit controls
  if (selectionControls) selectionControls.enabled = false;

  // Add circuit to racing scene
  if (circuitModel) {
    const v3 = (v) => `(${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`;
    
    // Debug: log original circuit dimensions
    const origBox = new THREE.Box3().setFromObject(circuitModel);
    const origSize = new THREE.Vector3();
    origBox.getSize(origSize);
    const origCenter = new THREE.Vector3();
    origBox.getCenter(origCenter);
    console.log('Circuit original size:', v3(origSize));
    console.log('Circuit original center:', v3(origCenter));
    console.log('Circuit original min:', v3(origBox.min));
    console.log('Circuit original max:', v3(origBox.max));

    // Scale circuit to a reasonable size
    const maxDim = Math.max(origSize.x, origSize.z);
    let circuitScale = 1;
    if (maxDim < 100) {
      circuitScale = 500 / maxDim;
    }
    console.log('Circuit scale factor:', circuitScale);
    circuitModel.scale.multiplyScalar(circuitScale);

    // Recalculate after scaling
    const box = new THREE.Box3().setFromObject(circuitModel);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);

    console.log('Circuit scaled size:', v3(size));
    console.log('Circuit scaled center:', v3(center));
    console.log('Circuit scaled min:', v3(box.min));
    console.log('Circuit scaled max:', v3(box.max));

    // Center the circuit at origin
    circuitModel.position.x -= center.x;
    circuitModel.position.z -= center.z;
    // Place on ground: ensure the bottom of the circuit is at y=0
    circuitModel.position.y -= box.min.y;

    circuitModel.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    racingScene.add(circuitModel);

    // Recalculate final bounds
    const finalBox = new THREE.Box3().setFromObject(circuitModel);
    const finalSize = new THREE.Vector3();
    finalBox.getSize(finalSize);
    console.log('Circuit FINAL min:', v3(finalBox.min), 'max:', v3(finalBox.max));
    console.log('Circuit FINAL size:', v3(finalSize));

    // Store circuit bounds for reference
    racingScene.userData.circuitCenter = new THREE.Vector3(0, 0, 0);
    racingScene.userData.circuitSize = finalSize;
  }

  // Clone selected car and add to racing scene
  const originalCar = carModels[selectedCar];
  selectedCarModel = originalCar.clone();

  const carContainer = new THREE.Group();
  carContainer.add(selectedCarModel);

  // Normalize car for racing (reasonable F1 car size ~5m long)
  normalizeModel(selectedCarModel, 5);
  const carBox = new THREE.Box3().setFromObject(selectedCarModel);
  selectedCarModel.position.y = -carBox.min.y;

  // Debug car dimensions
  const carSize = new THREE.Vector3();
  carBox.getSize(carSize);
  const carCenter = new THREE.Vector3();
  carBox.getCenter(carCenter);
  console.log(`Car size: (${carSize.x.toFixed(2)}, ${carSize.y.toFixed(2)}, ${carSize.z.toFixed(2)})`);
  console.log(`Car box min: (${carBox.min.x.toFixed(2)}, ${carBox.min.y.toFixed(2)}, ${carBox.min.z.toFixed(2)})`);
  console.log(`Car box max: (${carBox.max.x.toFixed(2)}, ${carBox.max.y.toFixed(2)}, ${carBox.max.z.toFixed(2)})`);
  console.log(`Car center: (${carCenter.x.toFixed(2)}, ${carCenter.y.toFixed(2)}, ${carCenter.z.toFixed(2)})`);

  carContainer.userData.carHeight = carSize.y;
  carContainer.userData.carLength = Math.max(carSize.x, carSize.z);
  carContainer.userData.carWidth = Math.min(carSize.x, carSize.z);

  carContainer.name = 'playerCar';

  selectedCarModel.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  racingScene.add(carContainer);

  // Find a good starting position on the track using raycasting
  const raycaster = new THREE.Raycaster();
  let startPos = new THREE.Vector3(0, 200, 0);
  let startY = 0;
  let foundTrack = false;

  // Try different positions to find the track surface
  const testPositions = [
    [0, 0],
    [100, 0], [-100, 0], [0, 100], [0, -100],
    [200, 200], [-200, -200], [300, 0], [0, 300],
    [500, 500], [-500, -500], [500, -500], [-500, 500],
    [800, 0], [0, 800], [-800, 0], [0, -800],
    [1000, 0], [0, 1000], [-1000, 0], [0, -1000],
    [0, 2000], [0, -2000], [1000, 1000],
  ];

  for (const [tx, tz] of testPositions) {
    raycaster.set(new THREE.Vector3(tx, 300, tz), new THREE.Vector3(0, -1, 0));
    const intersects = raycaster.intersectObjects(racingScene.children, true);
    for (const hit of intersects) {
      // Skip the fallback ground plane (which is at y=-0.5)
      if (hit.point.y > 0 && hit.object.geometry?.type !== 'PlaneGeometry') {
        console.log(`Track hit at (${tx}, ${tz}): y=${hit.point.y.toFixed(2)}, object: ${hit.object.name || hit.object.type}`);
        if (!foundTrack) {
          startPos.set(tx, hit.point.y + 0.1, tz);
          startY = hit.point.y + 0.1;
          foundTrack = true;
        }
      }
    }
  }

  if (!foundTrack) {
    // Fallback: place car at the average height of the circuit
    console.log('No track surface found via raycast, using estimated height');
    startPos.set(0, 50, 0);
    startY = 50;
  }

  console.log(`Starting position: (${startPos.x.toFixed(2)}, ${startPos.y.toFixed(2)}, ${startPos.z.toFixed(2)})`);

  // Store start position globally for reset
  startPosition.copy(startPos);

  carContainer.position.copy(startPos);

  // Reset car state
  carState.speed = 0;
  carState.position.copy(startPos);
  carState.rotation = 0;
  carState.turnSpeed = 0;
  carState.gear = 'N';

  // Store raycaster for ground following
  racingScene.userData.raycaster = raycaster;

  // Show HUD
  document.getElementById('racing-hud').classList.remove('hidden');
  document.getElementById('racing-hud').classList.add('fade-in');
  
  // Show Portfolio Panel
  setTimeout(() => {
    document.getElementById('portfolio-panel').classList.add('visible');
  }, 1000);

  // Setup key listener for camera toggle and escape
  window.addEventListener('keydown', handleRacingKeys);

  // Set initial cockpit camera - position it properly first
  cameraMode = 'cockpit';
  camera.fov = 75;
  camera.updateProjectionMatrix();

  // Initialize camera position at cockpit
  const initOffset = new THREE.Vector3(0, 1.5, -0.8);
  camera.position.copy(startPos.clone().add(initOffset));
  const initLook = new THREE.Vector3(0, 1.2, -15);
  camera.lookAt(startPos.clone().add(initLook));
}

function handleRacingKeys(e) {
  if (e.code === 'KeyC') {
    cycleCameraMode();
  }
  if (e.code === 'KeyR') {
    resetCarPosition();
  }
  if (e.code === 'Escape') {
    backToSelection();
  }
}

function cycleCameraMode() {
  const modes = ['cockpit', 'chase', 'top'];
  const idx = modes.indexOf(cameraMode);
  cameraMode = modes[(idx + 1) % modes.length];

  switch (cameraMode) {
    case 'cockpit':
      camera.fov = 75;
      break;
    case 'chase':
      camera.fov = 60;
      break;
    case 'top':
      camera.fov = 50;
      break;
  }
  camera.updateProjectionMatrix();
}

function resetCarPosition() {
  carState.speed = 0;
  carState.position.copy(startPosition);
  carState.rotation = 0;
  carState.turnSpeed = 0;
}

function backToSelection() {
  currentScene = 'selection';
  
  // Hide racing UI and Portfolio panel
  document.getElementById('racing-hud').classList.add('hidden');
  document.getElementById('racing-hud').classList.remove('fade-in');
  document.getElementById('portfolio-panel').classList.remove('visible');

  // Remove car from racing scene
  const playerCar = racingScene.getObjectByName('playerCar');
  if (playerCar) racingScene.remove(playerCar);

  // Re-enable controls
  if (selectionControls) selectionControls.enabled = true;

  // Reset camera
  camera.position.set(0, 6, 16);
  camera.lookAt(0, 1, 0);
  camera.fov = 60;
  camera.updateProjectionMatrix();

  // Show selection screen
  document.getElementById('racing-hud').classList.add('hidden');
  document.getElementById('selection-screen').classList.remove('hidden');
  document.getElementById('selection-screen').classList.remove('fade-out');
  document.getElementById('selection-screen').classList.add('fade-in');

  window.removeEventListener('keydown', handleRacingKeys);
}

// ============================================================
// GAME LOOP
// ============================================================
let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const delta = Math.min((now - lastTime) / 1000, 0.05); // Cap delta
  lastTime = now;

  if (currentScene === 'selection') {
    updateSelection(delta);
    renderer.render(selectionScene, camera);
  } else if (currentScene === 'racing') {
    updateRacing(delta);
    renderer.render(racingScene, camera);
  }
}

function updateSelection(delta) {
  // Rotate cars slowly
  selectionScene.children.forEach(child => {
    if (child.isGroup && child.userData.name) {
      child.rotation.y += delta * 0.5;
    }
  });

  if (selectionControls) selectionControls.update();
}

function updateRacing(delta) {
  const playerCar = racingScene.getObjectByName('playerCar');
  if (!playerCar) return;

  // ---- Input Processing ----
  const isAccelerating = keys['ArrowUp'] || keys['KeyW'];
  const isBraking = keys['ArrowDown'] || keys['KeyS'];
  const isTurningLeft = keys['ArrowLeft'] || keys['KeyA'];
  const isTurningRight = keys['ArrowRight'] || keys['KeyD'];

  // ---- Speed ----
  if (isAccelerating) {
    carState.speed += carState.acceleration * delta;
  } else if (isBraking) {
    carState.speed -= carState.braking * delta;
  } else {
    // Friction/drag
    if (carState.speed > 0) {
      carState.speed -= carState.friction * delta;
      if (carState.speed < 0) carState.speed = 0;
    } else if (carState.speed < 0) {
      carState.speed += carState.friction * delta;
      if (carState.speed > 0) carState.speed = 0;
    }
  }

  // Clamp speed
  carState.speed = Math.max(-60, Math.min(carState.maxSpeed, carState.speed));

  // ---- Steering ----
  const speedFactor = Math.min(Math.abs(carState.speed) / 50, 1); // Turn only when moving

  if (isTurningLeft) {
    carState.turnSpeed += carState.turnAcceleration * delta * speedFactor;
  } else if (isTurningRight) {
    carState.turnSpeed -= carState.turnAcceleration * delta * speedFactor;
  } else {
    // Return steering to center
    if (carState.turnSpeed > 0) {
      carState.turnSpeed -= carState.turnFriction * delta;
      if (carState.turnSpeed < 0) carState.turnSpeed = 0;
    } else if (carState.turnSpeed < 0) {
      carState.turnSpeed += carState.turnFriction * delta;
      if (carState.turnSpeed > 0) carState.turnSpeed = 0;
    }
  }

  carState.turnSpeed = Math.max(-carState.maxTurnSpeed, Math.min(carState.maxTurnSpeed, carState.turnSpeed));

  // ---- Apply Movement ----
  // Convert speed from km/h to units/s (rough: 1 unit ≈ 1 meter, so /3.6)
  const speedMs = carState.speed / 3.6;

  carState.rotation += carState.turnSpeed * delta;
  carState.position.x -= Math.sin(carState.rotation) * speedMs * delta;
  carState.position.z -= Math.cos(carState.rotation) * speedMs * delta;

  // ---- Ground Following (Raycast) ----
  const raycaster = racingScene.userData.raycaster;
  if (raycaster) {
    raycaster.set(
      new THREE.Vector3(carState.position.x, carState.position.y + 50, carState.position.z),
      new THREE.Vector3(0, -1, 0)
    );
    const hits = raycaster.intersectObjects(racingScene.children, true);
    for (const hit of hits) {
      if (hit.object.geometry?.type !== 'PlaneGeometry' && hit.point.y > -1) {
        carState.position.y = hit.point.y + 0.1;
        break;
      }
    }
  }

  playerCar.position.copy(carState.position);
  playerCar.rotation.y = carState.rotation;

  // ---- Gear Calculation ----
  const absSpeed = Math.abs(carState.speed);
  if (absSpeed < 1) carState.gear = 'N';
  else if (carState.speed < 0) carState.gear = 'R';
  else if (absSpeed < 60) carState.gear = '1';
  else if (absSpeed < 110) carState.gear = '2';
  else if (absSpeed < 160) carState.gear = '3';
  else if (absSpeed < 210) carState.gear = '4';
  else if (absSpeed < 260) carState.gear = '5';
  else if (absSpeed < 300) carState.gear = '6';
  else carState.gear = '7';

  // ---- Camera ----
  updateCamera(playerCar, delta);

  // ---- HUD ----
  updateHUD();
}

function updateCamera(carObject, delta) {
  const carPos = carObject.position;
  const carRot = carObject.rotation.y;

  // Note: In Three.js, the default forward direction is -Z.
  // When carRot=0, forward = -Z direction.
  switch (cameraMode) {
    case 'cockpit': {
      // Position camera at driver's head position (inside the car)
      // Offset: slightly forward from center, at head height
      const cockpitOffset = new THREE.Vector3(0, 1.5, -0.8);
      cockpitOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), carRot);

      const targetPos = carPos.clone().add(cockpitOffset);
      camera.position.lerp(targetPos, 0.2);

      // Look forward (far ahead in the -Z direction relative to car)
      const lookDir = new THREE.Vector3(0, 1.0, -15);
      lookDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), carRot);
      const lookTarget = carPos.clone().add(lookDir);
      camera.lookAt(lookTarget);
      break;
    }

    case 'chase': {
      // Behind and above the car (positive Z = behind when facing -Z)
      const chaseOffset = new THREE.Vector3(0, 1.8, 5);
      chaseOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), carRot);

      const targetPos = carPos.clone().add(chaseOffset);
      camera.position.lerp(targetPos, 0.2);

      const lookTarget = carPos.clone().add(new THREE.Vector3(0, 0.5, 0));
      camera.lookAt(lookTarget);
      break;
    }

    case 'top': {
      // Bird's eye view - closer
      const topOffset = new THREE.Vector3(0, 15, 5);
      topOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), carRot);

      const targetPos = carPos.clone().add(topOffset);
      camera.position.lerp(targetPos, 0.05);

      camera.lookAt(carPos);
      break;
    }
  }
}

function updateHUD() {
  const speedEl = document.getElementById('speed-value');
  const gearEl = document.getElementById('gear-value');
  const revBar = document.getElementById('rev-bar');

  const displaySpeed = Math.abs(Math.round(carState.speed));
  speedEl.textContent = displaySpeed;
  gearEl.textContent = carState.gear;

  // Rev bar (based on speed within current gear range)
  const revPercent = Math.min((displaySpeed / carState.maxSpeed) * 100, 100);
  revBar.style.width = revPercent + '%';

  // Change rev bar color near redline
  if (revPercent > 85) {
    revBar.style.background = 'linear-gradient(90deg, #00ff88, #ffff00, #ff0000, #ff0000)';
  } else if (revPercent > 60) {
    revBar.style.background = 'linear-gradient(90deg, #00ff88, #ffff00, #ff6600)';
  } else {
    revBar.style.background = 'linear-gradient(90deg, #00ff88, #44ff44)';
  }
}

// ============================================================
// RESIZE
// ============================================================
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================================
// START
// ============================================================
init();
