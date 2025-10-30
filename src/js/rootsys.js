import * as THREE from 'three';

const ThreeUtils = {
  addSphere(scene, { position, radius = 0.9 }) {
    const geometry = new THREE.SphereGeometry(radius, 12, 12);
    const material = new THREE.MeshStandardMaterial({
      color: 0x65_43_21,
      roughness: 0.8,
      metalness: 0.2
    });

    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(position);

    return scene.add(sphere);
  },
  drawSpline(branch) {
    if (branch.rootPoints.length > 0) {
      const curve = new THREE.CatmullRomCurve3(
        branch.rootPoints,
        false,
        'catmullrom',
        1
      );
      const points = curve.getPoints(branch.rootPoints.length * 5);

      return this.genRootMesh({
        curvePoints: points,
        curve,
        radius: branch.branchRadii
      });
    }
  },
  genRootMesh({ curvePoints, curve, radius }) {
    const radialSegments = 20;
    const numpoints = curvePoints.length;
    const radiusLength = radius.length;

    const frames = curve.computeFrenetFrames(numpoints, false);

    const circleVertices = [];
    for (let index = 0; index < numpoints; index++) {
      const u = index / (numpoints - 1);
      const t = (radiusLength - 1) * u;
      const lower = Math.floor(t);
      const upper = Math.min(lower + 1, radiusLength - 1);
      const frac = t - lower;
      const posRadius = radius[lower] * (1 - frac) + radius[upper] * frac;

      const pos = curve.getPointAt(u);
      const normal = frames.normals[index];
      const binormal = frames.binormals[index];

      const circle = [];
      for (let index = 0; index < radialSegments; index++) {
        const v = (index / radialSegments) * 2 * Math.PI;
        const cx = -posRadius * Math.cos(v);
        const cy = posRadius * Math.sin(v);

        const vertex = pos.clone();
        vertex.x += cx * normal.x + cy * binormal.x;
        vertex.y += cx * normal.y + cy * binormal.y;
        vertex.z += cx * normal.z + cy * binormal.z;

        circle.push(vertex);
      }
      circleVertices.push(circle);
    }

    function* verticesGen() {
      for (let index = 0; index < numpoints; index++) {
        for (let index_ = 0; index_ < radialSegments; index_++) {
          const v = circleVertices[index][index_];
          yield [v.x, v.y, v.z];
        }
      }
    }

    function* indicesGen() {
      for (let index = 0; index < numpoints - 1; index++) {
        for (let index_ = 0; index_ < radialSegments; index_++) {
          const a = index * radialSegments + index_;
          const b = index * radialSegments + ((index_ + 1) % radialSegments);
          const c =
            (index + 1) * radialSegments + ((index_ + 1) % radialSegments);
          const d = (index + 1) * radialSegments + index_;

          yield [a, b, d, b, c, d];
        }
      }
    }

    return { verticesGen, indicesGen };
  }
};

class RootSegment {
  constructor(scene, { start, end, rootPoints, branchRadii, growthSpeed }) {
    this.scene = scene;
    this.start = start;
    this.end = end;
    this.rootPoints = rootPoints; // array of THREE.Vector3
    this.branchRadii = branchRadii;
    this.growthSpeed = growthSpeed;

    this.timer = 0;

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
  }
  update(deltaTime) {
    this.timer += deltaTime;
    if (this.timer < this.growthSpeed) return;
    this.timer = 0;

    if (!this.verticeGen || !this.indiceGen) return;

    const growthRate = 10;

    for (let i = 0; i < growthRate; i++) {
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
    return startRadius * Math.pow(0.5, currentDepth);
  },
  SIGMOID: (startRadius, currentDepth) => {
    return startRadius * (1 / (1 + Math.exp(currentDepth)));
  }
};

const DEFAULT_DECAY_METHOD = DecayMethods.EXPONENTIAL;

export default class AnimatedRootSystem {
  constructor(
    scene,
    {
      maxDepth = 3,
      baseBranchLength = 3,
      spread = 0.01,
      maxChildren = 1,
      growthSpeed = 50, // ms between segment pieces
      newBranchRate = 3000, // ms between new branches
      startingBranches = 100,
      startRadius = 0.15,
      decayMethod = DecayMethods.SIGMOID
    } = {}
  ) {
    this.scene = scene;

    // parameters
    this.maxDepth = maxDepth;
    this.baseBranchLength = baseBranchLength;
    this.startRadius = startRadius;
    this.spread = spread;
    this.maxChildren = maxChildren;
    this.growthSpeed = growthSpeed;
    this.newBranchRate = newBranchRate;
    this.startingBranches = startingBranches;
    this.decayMethod = decayMethod || DEFAULT_DECAY_METHOD;

    this.growthQueue = [];
    this.branches = [];

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
    if (this.lastGrowthTime < this.newBranchRate) return;

    if (this.growthQueue.length > 0) {
      this.lastGrowthTime = 0;

      // Do batching if growtime allows to put less strain on the cpu from wait time
      const branchesPerFrame = 1;
      for (let i = 0; i < branchesPerFrame; i++) {
        if (this.growthQueue.length <= 0) return;

        const { node, branchLength } = this.growthQueue.shift();
        if (node.depth < this.maxDepth) {
          this.growNode(node, branchLength);
        }
      }
    }
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
