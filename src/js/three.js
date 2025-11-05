import * as T from 'three';
// eslint-disable-next-line import/no-unresolved
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import AnimatedRootSystem from './rootsys.js';

import AnimatedLeafSystem from './leafsys.js';

const device = {
  width: window.innerWidth,
  height: window.innerHeight,
  pixelRatio: window.devicePixelRatio
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

    this.loader = new GLTFLoader();
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

    this.setLights();
    // this.setModel('/src/models/taro/scene.gltf');
    this.setModel('punahou-farm/models/corm.glb');
    this.createRootSys();
    this.createLeafSys();
    this.render();
    this.setResize();
  }

  setLights() {
    this.directionLight = new T.DirectionalLight(new T.Color(1, 1, 1, 1), 2);
    this.ambientLight = new T.AmbientLight(0xff_ff_ff, 1);
    this.scene.add(this.directionLight);
    this.scene.add(this.ambientLight);
  }

  createRootSys() {
    this.RootSystem = new AnimatedRootSystem(this.scene);
  }

  createLeafSys() {
    this.LeafSystem = new AnimatedLeafSystem(this.scene);
  }

  // regenerateSim() {}

  setModel(path) {
    this.loader.load(
      path,
      (gltf) => {
        this.scene.add(gltf.scene);
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
      },
      (error) => {
        console.error('Error loading GLTF model:', error);
      }
    );
  }

  render() {
    // const elapsedTime = this.clock.getElapsedTime();
    const deltaTime = this.clock.getDelta() * 10_000; // convert to ms

    // Update root system animation
    if (this.RootSystem) {
      this.RootSystem.update(deltaTime);
      for (const branch of this.RootSystem.branches) {
        branch.update(deltaTime);
      }
    }

    if (this.LeafSystem) {
      this.LeafSystem.update(deltaTime);
    }

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.render.bind(this));
  }

  setResize() {
    window.addEventListener('resize', this.onResize.bind(this));
  }

  onResize() {
    device.width = window.innerWidth;
    device.height = window.innerHeight;

    this.camera.aspect = device.width / device.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(device.width, device.height);
    this.renderer.setPixelRatio(Math.min(device.pixelRatio, 2));
  }
}
