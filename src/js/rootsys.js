import * as THREE from 'three';

import ThreeUtils from './threeutils.js';

class RootSegment {
  constructor(scene, { start, end, rootPoints, branchRadii, growthSpeed }) {
    this.scene = scene;
    this.start = start;
    this.end = end;
    this.rootPoints = rootPoints; // array of THREE.Vector3
    this.branchRadii = branchRadii;
    this.growthSpeed = growthSpeed;
    this.branchSegs = new THREE.Group();
    // this.scene.add(this.branchSegs);

    this.timer = 0;

    this.done = false;

    this.vertices = [];
    this.indices = [];

    const { verticesGen, indicesGen } = ThreeUtils.drawSpline(this);

    this.verticeGen = verticesGen();
    this.indiceGen = indicesGen();

    this.tubeMat = new THREE.MeshStandardMaterial({
      color: 0xe3_e1_d2,
      emissive: 0xce_86_54,
      emissiveIntensity: 0.4,
      roughness: 0.4,
      metalness: 0.05,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.tubeMat);
    this.scene.add(this.mesh);
    this.branchSegs.add(this.mesh);
  }

  update(deltaTime) {
    if (this.done) return;
    this.timer += deltaTime;
    if (this.timer < this.growthSpeed) return;
    this.timer = 0;

    if (!this.verticeGen || !this.indiceGen) return;

    const growthRate = 10;

    for (let index = 0; index < growthRate; index++) {
      const v = this.verticeGen.next();
      if (v.done) break;
      this.vertices.push(...v.value);
    }

    const ind = this.indiceGen.next();
    if (ind.done) {
      this.done = true;
    } else {
      this.indices.push(...ind.value);
    }

    // if (this.vertices.length < 6 || this.indices.length < 6) return;

    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(this.vertices, 3)
    );
    geom.setIndex(this.indices);
    geom.computeVertexNormals();

    if (this.mesh.geometry) this.mesh.geometry.dispose();
    this.mesh.geometry = geom;
  }
}

class KDNode {
  constructor(point, radius, depth) {
    this.point = point;
    this.radius = radius;
    this.depth = depth;
  }
}

const DecayMethods = {
  INVERSE: (startRadius, currentDepth) => {
    return startRadius * (1 / currentDepth);
  },
  EXPONENTIAL: (startRadius, currentDepth) => {
    return startRadius * Math.pow(0.5, currentDepth);
  },
  SIGMOID: (startRadius, currentDepth) => {
    return startRadius * (1 / (1 + Math.exp(currentDepth)));
  }
};

export const DEFAULT_DECAY_METHOD = DecayMethods.SIGMOID;

export class AnimatedRootSystem {
  constructor(scene, config) {
    this.scene = scene;

    // parameters
    this.maxDepth = config.maxDepth;
    this.baseBranchLength = config.baseBranchLength;
    this.startRadius = config.startRadius;
    this.spread = config.spread;
    this.maxChildren = config.maxChildren;
    this.growthSpeed = config.growthSpeed;
    this.newBranchRate = config.newBranchRate;
    this.startingBranches = config.startingBranches;
    this.decayMethod = config.decayMethod;

    this.growthQueue = [];
    this.branches = [];
    this.rootGroup = [];

    // root node at origin
    this.root = new KDNode(new THREE.Vector3(0, 0, 0), this.startRadius, 0);

    for (let index = 0; index < this.startingBranches; index++) {
      this.growthQueue.push({
        node: this.root,
        branchLength: this.baseBranchLength
      });
    }

    // start animation
    this.lastGrowthTime = 0;
  }

  update(deltaTime) {
    this.lastGrowthTime += deltaTime;
    // console.log(this.lastGrowthTime);
    if (this.lastGrowthTime < this.newBranchRate) return;

    if (this.growthQueue.length > 0) {
      this.lastGrowthTime = 0;

      // Do batching if growtime allows to put less strain on the cpu from wait time
      const branchesPerFrame = 1;
      for (let index = 0; index < branchesPerFrame; index++) {
        if (this.growthQueue.length <= 0) return;

        const { node, branchLength } = this.growthQueue.shift();
        if (node.depth < this.maxDepth) {
          this.growNode(node, branchLength);
        }

        for (const branch of this.branches) {
          if (!this.rootGroup.includes(branch.branchSegs)) {
            this.rootGroup.push(branch.branchSegs);
          }
        }
      }

    }
    // console.log(this.rootGroup);

  }

  growNode(node, branchLength) {
    if (node.depth < 0) return;

    const childPoints = [];
    const radii = [];
    const homePoint = node.point.clone();

    childPoints.push(homePoint);
    radii.push(node.radius);

    const currentPos = node.point.clone();

    for (
      let currentDepth = node.depth + 1;
      currentDepth <= node.depth + this.maxDepth;
      currentDepth++
    ) {
      const randomLength = branchLength * (0.7 + Math.random() * 0.6);

      const dx = (Math.random() * 2 - 1) * this.spread * 0.2;
      const dy = -Math.abs(Math.random() * this.spread);
      const dz = (Math.random() * 2 - 1) * this.spread * 0.2;

      const dirVector = new THREE.Vector3(dx, dy, dz).normalize();

      const endPosVector = currentPos
        .clone()
        .add(dirVector.multiplyScalar(randomLength));
      const radius = this.decayMethod(this.startRadius, currentDepth);

      const endPoint = new KDNode(endPosVector, radius, currentDepth);
      childPoints.push(endPosVector);
      radii.push(radius);

      if (currentDepth === node.depth + this.maxDepth) {
        const branch = new RootSegment(this.scene, {
          start: homePoint,
          end: endPoint,
          rootPoints: childPoints,
          branchRadii: radii,
          growthSpeed: this.growthSpeed
        });
        this.branches.push(branch);

        
        this.growthQueue.push({
          node: endPoint,
          branchLength: homePoint.distanceTo(endPosVector)
        });
      }

      currentPos.copy(endPosVector);
    }
  }
}
