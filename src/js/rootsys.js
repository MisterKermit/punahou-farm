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

    scene.add(sphere);
  },
  drawSpline(scene, branch) {
    if (branch.rootPoints.length > 0) {
      const curve = new THREE.CatmullRomCurve3(
        branch.rootPoints,
        false,
        'catmullrom',
        1
      );
      const points = curve.getPoints(branch.rootPoints.length * 5);

      const tubeMat = new THREE.MeshStandardMaterial({
        color: 0xe3_e1_d2,
        emissive: 0xce_86_54,
        emissiveIntensity: 0.4,
        roughness: 0.4,
        metalness: 0.05,
        side: THREE.DoubleSide
      });

      this.genRootMesh(scene, {
        curvePoints: points,
        curve,
        radius: branch.branchRadii,
        tubeMat
      });
    }
  },
  genRootMesh(scene, { curvePoints, curve, radius, tubeMat }) {
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

    const vertices = [];
    for (let index = 0; index < numpoints; index++) {
      for (let index_ = 0; index_ < radialSegments; index_++) {
        const v = circleVertices[index][index_];
        vertices.push(v.x, v.y, v.z);
      }
    }

    const indices = [];
    for (let index = 0; index < numpoints - 1; index++) {
      for (let index_ = 0; index_ < radialSegments; index_++) {
        const a = index * radialSegments + index_;
        const b = index * radialSegments + ((index_ + 1) % radialSegments);
        const c =
          (index + 1) * radialSegments + ((index_ + 1) % radialSegments);
        const d = (index + 1) * radialSegments + index_;

        indices.push(a, b, d, b, c, d);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3)
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(geometry, tubeMat);
    scene.add(mesh);
  }
};

class RootSegment {
  constructor(start, end, rootPoints, branchRadii) {
    this.start = start;
    this.end = end;
    this.rootPoints = rootPoints; // array of THREE.Vector3
    this.branchRadii = branchRadii;
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
      // growthSpeed = 0, // ms between new branches
      startingBranches = 1,
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
    // this.growthSpeed = growthSpeed;
    this.startingBranches = startingBranches;
    this.decayMethod = decayMethod || DEFAULT_DECAY_METHOD;

    this.growthQueue = [];

    // root node at origin
    this.root = new KDNode(new THREE.Vector3(0, 0, 0), this.startRadius, 0);
    ThreeUtils.addSphere(this.scene, {
      position: this.root.point,
      radius: 1.5
    });

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

    if (this.growthQueue.length > 0) {
      this.lastGrowthTime = 0;

      const branchesPerFrame = 5;
      for (
        let i = 0;
        i < branchesPerFrame && this.growthQueue.length > 0;
        i++
      ) {
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
        const branch = new RootSegment(homePoint, endPoint, childPoints, radii);
        ThreeUtils.drawSpline(this.scene, branch);
        this.growthQueue.push({
          node: endPoint,
          branchLength: homePoint.distanceTo(endPosVector)
        });
      }

      currentPos.copy(endPosVector);
    }
  }
}
