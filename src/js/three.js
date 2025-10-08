import * as T from 'three';
// eslint-disable-next-line import/no-unresolved
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import fragment from '../shaders/fragment.glsl';
import vertex from '../shaders/vertex.glsl';
import AnimatedRootSystem from './rootsys.js';

const device = {
  width: globalThis.innerWidth,
  height: globalThis.innerHeight,
  pixelRatio: globalThis.devicePixelRatio
};

export default class Three {
  constructor(canvas) {
    this.canvas = canvas;

    this.scene = new T.Scene();

    this.camera = new T.PerspectiveCamera(
      75,
      device.width / device.height,
      0.1,
      100
    );
    this.camera.position.set(0, 0, 10);
    this.scene.add(this.camera);

    this.renderer = new T.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true
    });
    this.renderer.setSize(device.width, device.height);
    this.renderer.setPixelRatio(Math.min(device.pixelRatio, 2));

    this.controls = new OrbitControls(this.camera, this.canvas);

    this.clock = new T.Clock();

    this.options = {
      depth: 6,
      baseBranchLength: 5,
      spread: 2,
      maxChildren: 20,
      branchDecay: 0.8,
      branchChance: 0.75,
      growthSpeed: 0 // ms between new branches
    };

    this.setLights();
    // this.setModel();
    this.createRootSys();
    this.render();
    this.setResize();
  }

  setLights() {
    this.directionLight = new T.DirectionalLight(new T.Color(1, 1, 1, 1));
    this.scene.add(this.directionLight);
  }

  createRootSys() {
    document.querySelector('#debug-menu-content').textContent = JSON.stringify(
      this.options,
      undefined,
      2
    );
    this.RootSystem = new AnimatedRootSystem(this.scene, this.options);
  }

  setModel() {
    const loader = new GLTFLoader();
    loader.load(
      'src/assets/models/taro/scene.gltf',
      (gltf) => {
        this.scene.add(gltf.scene);
      },
      undefined,
      (error) => {
        console.error('Error loading GLTF model:', error);
      }
    );
  }

  render() {
    const elapsedTime = this.clock.getElapsedTime();
    const deltaTime = this.clock.getDelta() * 10_000; // convert to ms

    // Uncomment if you want to rotate something
    // if (this.planeMesh) {
    //   this.planeMesh.rotation.x = 0.2 * elapsedTime;
    //   this.planeMesh.rotation.y = 0.1 * elapsedTime;
    // }

    // Update root system animation
    if (this.RootSystem) {
      this.RootSystem.update(deltaTime, elapsedTime);
    }

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.render.bind(this));
  }

  setResize() {
    globalThis.addEventListener('resize', this.onResize.bind(this));
  }

  onResize() {
    device.width = globalThis.innerWidth;
    device.height = globalThis.innerHeight;

    this.camera.aspect = device.width / device.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(device.width, device.height);
    this.renderer.setPixelRatio(Math.min(device.pixelRatio, 2));
  }
}
