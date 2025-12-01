import * as THREE from 'three';

// eslint-disable-next-line import/no-unresolved
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// eslint-disable-next-line import/no-unresolved
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import {
  AnimatedRootSystem,
  DEFAULT_DECAY_METHOD as rootDecayMethod
} from './rootsys.js';

import {
  AnimatedLeafSystem,
  DEFAULT_DECAY_METHOD as stemDecayMethod
} from './leafsys.js';

const device = {
  width: window.innerWidth,
  height: window.innerHeight,
  pixelRatio: window.devicePixelRatio
};

export default class Three {
  constructor(canvas) {
    this.canvas = canvas;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      75,
      device.width / device.height,
      0.1,
      100
    );

    this.camera.position.set(0, 0, 10);
    this.scene.add(this.camera);

    this.loader = new GLTFLoader();
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true
    });
    this.renderer.setSize(device.width, device.height);
    this.renderer.setPixelRatio(Math.min(device.pixelRatio, 2));

    this.controls = new OrbitControls(this.camera, this.canvas);

    this.clock = new THREE.Clock();

    const gridHelper = new THREE.GridHelper(100, 10);
    this.scene.add(gridHelper);

    this.setLights();
    // this.setModel('/src/models/taro/scene.gltf');
    this.setModel('/punahou-farm/models/corm.glb');
    this.createRootSys();
    this.createLeafSys();
    this.render();
    this.setResize();
  }

  setLights() {
    this.directionLight = new THREE.DirectionalLight(
      new THREE.Color(1, 1, 1, 1),
      2
    );
    this.ambientLight = new THREE.AmbientLight(0xff_ff_ff, 1);
    this.scene.add(this.directionLight);
    this.scene.add(this.ambientLight);
  }

  createRootSys() {
    const config = {
      maxDepth: 3,
      baseBranchLength: 3,
      spread: 0.01,
      maxChildren: 1,
      growthSpeed: 25, // ms between segment pieces
      newBranchRate: 3000, // ms between new branches
      startingBranches: 100,
      startRadius: 0.15,
      decayMethod: rootDecayMethod
    };

    this.RootSystem = new AnimatedRootSystem(this.scene, config);
  }

  createLeafSys() {
    const config = {
      maxDepth: 5,
      baseBranchLength: 2,
      startRadius: 0.25,
      spread: 0.05,
      // maxChildren: 1,
      growthSpeed: 100, // ms between segment pieces
      newBranchRate: 10_000, // ms between new branches
      startingBuds: 3,
      startingBranchesPerBud: 3,
      decayMethod: stemDecayMethod
    };

    this.LeafSystem = new AnimatedLeafSystem(this.scene, config);
  }

  setModel(path) {
    this.loader.load(
      path,
      (gltf) => this.scene.add(gltf.scene),
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
      },
      (error) => {
        alert(`Issue in loading model: ${error}`);
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
      for (const branch of this.LeafSystem.branches) {
        branch.update(deltaTime);
      }
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
