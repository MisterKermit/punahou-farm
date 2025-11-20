import * as THREE from 'three';

import ThreeUtils from './threeutils.js';

class StemSegment {
  constructor(scene, { start, end, stemPoints, branchRadii, growthSpeed }) {
    this.scene = scene;
    this.start = start;
    this.end = end;
    this.stemPoints = stemPoints; // array of THREE.Vector3
    this.branchRadii = branchRadii;
    this.growthSpeed = growthSpeed;

    this.timer = 0;

    this.vertices = [];
    this.indices = [];

    const { verticesGen, indicesGen } = ThreeUtils.drawSpline(this);

    this.verticeGen = verticesGen();
    this.indiceGen = indicesGen();

    this.tubeMat = new THREE.MeshStandardMaterial({
      color: 0x14_33_00,
      emissive: 0x6bd822,
      emissiveIntensity: 0.4,
      roughness: 0.4,
      metalness: 0.05,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.tubeMat);
    this.scene.add(this.mesh);
  }
  update(deltaTime) {
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
    if (!ind.done) this.indices.push(...ind.value);

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
    return startRadius * Math.pow(0.65, currentDepth);
  },
  SIGMOID: (startRadius, currentDepth) => {
    return startRadius * (1 / (1 + Math.exp(currentDepth)));
  }
};

export const DEFAULT_DECAY_METHOD = DecayMethods.EXPONENTIAL;

export class AnimatedLeafSystem {
  constructor(scene, config) {
    this.scene = scene;

    // parameters
    this.maxDepth = config.maxDepth;
    this.baseBranchLength = config.baseBranchLength;
    this.startRadius = config.startRadius;
    this.spread = config.spread;
    // UNUSED: this.maxChildren = config.maxChildren;
    this.growthSpeed = config.growthSpeed;
    this.newBranchRate = config.newBranchRate;
    this.startingBuds = config.startingBuds;
    this.startingBranchesPerBud = config.startingBranchesPerBud;
    this.decayMethod = config.decayMethod;

    this.CORM_CONSTANT = 1.5;

    this.growthQueue = [];
    this.buds = [];
    this.branches = [];

    // stem node at origin
    this.root = new KDNode(new THREE.Vector3(0, 0, 0), this.startRadius, 0);

    const branchesNumber = this.startingBuds * this.startingBranchesPerBud;

    for (let index = 0; index < branchesNumber; index++) {
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
    if (this.lastGrowthTime < this.newBranchRate) return;

    if (this.buds.length <= 0) {
      for (let index = 0; index < this.startingBuds; index++) {
        this.growBud();
      }
    }

    if (this.growthQueue.length > 0) {
      this.lastGrowthTime = 0;

      // Do batching if growtime allows to put less strain on the cpu from wait time
      const branchesPerFrame = 1;
      for (let index = 0; index < branchesPerFrame; index++) {
        if (this.growthQueue.length <= 0) return;
        // Randomly assign branch to a bud. Create the bud if not exist and delay the growth.
        const budIndex = ThreeUtils.getRandomInt(this.buds.length);
        const bud = this.buds[budIndex];
        bud.children += 1;

        const { node, branchLength } = this.growthQueue.shift();
        if (node.depth < this.maxDepth) {
          this.growNode(bud, node, branchLength);
        }
      }
    }
  }

  growBud() {
    const dirVector = ThreeUtils.generate3dNoiseVector();
    dirVector.setY(Math.abs(dirVector.y));
    dirVector.multiplyScalar(this.CORM_CONSTANT);

    const bud = {
      point: dirVector,
      children: 0
    };
    this.buds.push(bud);
    ThreeUtils.addSphere(this.scene, { position: bud.point, radius: 0.3 });
  }

  growNode(bud, node, branchLength) {
    if (node.depth < 0) return;

    const childPoints = [];
    const radii = [];
    const homePoint = bud.point.clone();

    childPoints.push(homePoint);
    radii.push(node.radius);

    const currentPos = node.point.clone();

    for (
      let currentDepth = node.depth + 1;
      currentDepth <= node.depth + this.maxDepth;
      currentDepth++
    ) {
      const randomLength = branchLength * (0.7 + Math.random() * 0.6);

      const dirVector = ThreeUtils.generate3dNoiseVector(this.spread);
      dirVector.setY(Math.abs(dirVector.y));

      const endPosVector = currentPos
        .clone()
        .add(dirVector.multiplyScalar(randomLength));
      const radius = this.decayMethod(this.startRadius, currentDepth);

      const endPoint = new KDNode(endPosVector, radius, currentDepth);
      childPoints.push(endPosVector);
      radii.push(radius);

      if (currentDepth === node.depth + this.maxDepth) {
        const branch = new StemSegment(this.scene, {
          start: homePoint,
          end: endPoint,
          stemPoints: childPoints,
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
