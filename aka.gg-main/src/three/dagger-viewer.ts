// src/three/dagger-viewer.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type Viewer = {
  destroy: () => void;
};

export function createDaggerViewer(opts: {
  canvas: HTMLCanvasElement;
  modelUrl?: string;
}): Viewer {
  const { canvas, modelUrl = '/models/dagger.glb' } = opts;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(
    45,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    100
  );
  camera.position.set(2.5, 1.6, 3.5);

  // Luz ambiental más suave
scene.add(new THREE.AmbientLight(0xffffff, 0.8));

// Luz direccional principal
const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
mainLight.position.set(5, 8, 5);
scene.add(mainLight);

// Luz de relleno
const fillLight = new THREE.DirectionalLight(0x7eb4e2, 0.4);
fillLight.position.set(-5, 3, 2);
scene.add(fillLight);

  // Luces
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(5, 5, 5);
  scene.add(dir);
  const rim = new THREE.PointLight(0x00e0ff, 1.0, 10);
  rim.position.set(-3, 1.5, -2);
  scene.add(rim);

  // Suelo suave opcional
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(3, 64),
    new THREE.MeshStandardMaterial({ color: 0x0f1419, roughness: 0.85, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.6;
  scene.add(ground);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 1.6;
  controls.maxDistance = 6;

  // Cargar GLB
  const loader = new GLTFLoader();
  loader.load(
    modelUrl,
    (gltf) => {
      const root = gltf.scene;
      root.traverse((o) => {
        const m = o as THREE.Mesh & { material?: THREE.MeshStandardMaterial };
        if ((m as any).isMesh && m.material) {
  m.castShadow = m.receiveShadow = true;
  
  // Mejorar materiales estándar
  if (m.material instanceof THREE.MeshStandardMaterial) {
    m.material.roughness = 0.3;
    m.material.metalness = 0.7;
    
    // Efecto de emisión para el filo
    if (m.name.toLowerCase().includes('bladeedge')) {
      m.material.emissive = new THREE.Color(0xff375f);
      (m.material as any).emissiveIntensity = 1.5;
    }
  }
}
      });
      root.position.set(0, -0.25, 0);
      scene.add(root);
    },
    undefined,
    (err) => console.error('Error loading GLB:', err)
  );

  // Resize
  const onResize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);

  let stop = false;
  const tick = () => {
    if (stop) return;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };
  tick();

  return {
    destroy() {
      stop = true;
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if ((mesh as any).isMesh) {
          mesh.geometry?.dispose?.();
          // @ts-ignore
          mesh.material?.dispose?.();
        }
      });
    },
  };
}
