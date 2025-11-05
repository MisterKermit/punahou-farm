import * as THREE from 'three';

// import ThreeUtils from './threeutils.js';

class Branch {
  constructor(scene, { start, direction, maxRadius, maxHeight, growthSpeed }) {
    this.scene = scene;
    this.start = start;
    this.direction = direction;

    this.maxRadius = maxRadius;
    this.radius = 0.01;
    this.maxHeight = maxHeight;
    this.height = 1;

    this.growthSpeed = growthSpeed;

    this.timer = 0;

    this.coneMat = new THREE.MeshStandardMaterial({
      color: 0xa2_a5_69,
      emissive: 0x6d_71_2e,
      emissiveIntensity: 0.4,
      roughness: 0.4,
      metalness: 0.05,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.coneMat);
    this.mesh.position.copy(start);

    const target = new THREE.Vector3().addVectors(this.start, this.direction);

    this.mesh.lookAt(target);

    this.scene.add(this.mesh);
  }

  update(deltaTime) {
    this.timer += deltaTime;
    if (this.timer < this.growthSpeed) return;
    this.timer = 0;

    const newHeight = this.height + 0.01;
    if (newHeight < this.maxHeight) this.height = newHeight;

    const newRadius = this.radius + 0.05;
    if (newRadius < this.maxRadius) this.radius = newRadius;

    const geom = new THREE.ConeGeometry(this.radius, this.height);
    geom.translate(0, this.height / 2, 0);
    if (this.mesh.geometry) this.mesh.geometry.dispose();
    this.mesh.geometry = geom;
  }
}

export default class AnimatedLeafSystem {
  constructor(scene, config) {
    this.scene = scene;

    // parameters
    this.maxHeight = config.maxHeight;
    this.maxRadius = config.maxRadius;
    this.growthSpeed = config.growthSpeed;
    this.spread = config.spread;
    this.startingLeafs = config.startingLeafs;
    this.leafModel = config.leafModel;

    this.branches = [];

    for (let index = 0; index < this.startingLeafs; index++) {
      this.branches.push(this.generateBranch());
    }
  }

  generateBranch() {
    const start = new THREE.Vector3(0, 0, 0);

    const dx = (Math.random() * 2 - 1) * this.spread;
    const dy = Math.abs(Math.random() * this.spread);
    const dz = (Math.random() * 2 - 1) * this.spread;

    const direction = new THREE.Vector3(dx, dy, dz).normalize();

    return new Branch(this.scene, {
      start,
      direction,
      maxRadius: this.maxRadius,
      maxHeight: this.maxHeight,
      growthSpeed: this.growthSpeed
    });
  }

  update(deltatime) {
    for (const branch of this.branches) {
      branch.update(deltatime);
    }
  }
}
