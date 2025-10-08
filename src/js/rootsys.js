import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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

export default class AnimatedRootSystem {
  constructor(scene, {
    maxDepth = 6,
    baseBranchLength = 5,
    spread = 0.01,
    maxChildren = 20,
    branchDecay = 0.4,
    branchChance = 0.75,
    growthSpeed = 0, // ms between new branches
    startingBranches = 15,
    startRadius = 0.3
  } = {}) {
    this.scene = scene;

    // parameters
    this.maxDepth = maxDepth;
    this.baseBranchLength = baseBranchLength;
    this.startRadius = startRadius;
    this.spread = spread;
    this.maxChildren = maxChildren;
    this.branchDecay = branchDecay;
    this.branchChance = branchChance;
    this.growthSpeed = growthSpeed;
    this.startingBranches = startingBranches;

    // root node at origin
    this.root = new KDNode(new THREE.Vector3(0, 0, 0), this.startRadius, 0);
    this.addSphere(this.root.point, 0.4);

    // growth queue (holds [node, depth, branchLength])
    this.growthQueue = [[this.root, 0, this.baseBranchLength]];

    for (let i = 0; i < this.startingBranches; i++) {
      this.growthQueue.push([this.root, this.root.depth, this.baseBranchLength]);
    }

    // start animation
    this.lastGrowthTime = 0;
  }

  update(deltaTime) {
    this.lastGrowthTime += deltaTime;

    if (this.growthQueue.length > 0) {
      this.lastGrowthTime = 0;
      const [node, depth, branchLength] = this.growthQueue.shift();

      if (depth < this.maxDepth) {
        this.growNode(node, depth, branchLength);
      }
    }
  }

  growNode(node, depth, branchLength) {
    if (depth < 0) return;

    const childPoints = [];
    const radii = [];
    const homePoint = node.point.clone();

    childPoints.push(homePoint);
    radii.push(node.radius);

    const currentPos = node.point.clone();

    for (let currentDepth = depth + 1; currentDepth <= depth + this.maxDepth; currentDepth++) {
      const randomLength = branchLength * (0.7 + Math.random() * 0.6);

      const dx = (Math.random() * 2 - 1) * this.spread * 0.2;
      const dy = -Math.abs(Math.random() * this.spread);
      const dz = (Math.random() * 2 - 1) * this.spread * 0.2;

      const dirVector = new THREE.Vector3(dx, dy, dz).normalize();

      const endPosVector = currentPos.clone().add(dirVector.multiplyScalar(randomLength));
      const radius = this.startRadius * (1 / currentDepth);

      const endPoint = new KDNode(endPosVector, radius, currentDepth);
      childPoints.push(endPosVector);
      radii.push(radius);

      if (currentDepth === depth + this.maxDepth) {
        const branch = new RootSegment(homePoint, endPoint, childPoints, radii);
        this.drawSpline(branch);
        this.growthQueue.push([endPoint, currentDepth, homePoint.distanceTo(endPosVector)]);
      }

      currentPos.copy(endPosVector);
    }
  }

  drawSpline(branch) {
    if (branch.rootPoints.length > 0) {
      const curve = new THREE.CatmullRomCurve3(branch.rootPoints, false, 'catmullrom', 1);
      const points = curve.getPoints(branch.rootPoints.length * 5);

      const tubeMat = new THREE.MeshStandardMaterial({
        color: 0xe3e1d2,
        emissive: 0xce8654,
        emissiveIntensity: 0.4,
        roughness: 0.4,
        metalness: 0.05,
        side: THREE.DoubleSide
      });

      this.genRootMesh(points, curve, branch.branchRadii, tubeMat);
    }
  }

  genRootMesh(curvePoints, curve, radius, tubeMat) {
    const radialSegments = 20;
    const numpoints = curvePoints.length;
    const radiusLength = radius.length;

    const frames = curve.computeFrenetFrames(numpoints, false);

    const circleVertices = [];
    for (let i = 0; i < numpoints; i++) {
      const u = i / (numpoints - 1);
      const t = (radiusLength - 1) * u;
      const lower = Math.floor(t);
      const upper = Math.min(lower + 1, radiusLength - 1);
      const frac = t - lower;
      const posRadius = radius[lower] * (1 - frac) + radius[upper] * frac;

      const pos = curve.getPointAt(u);
      const normal = frames.normals[i];
      const binormal = frames.binormals[i];

      const circle = [];
      for (let j = 0; j < radialSegments; j++) {
        const v = (j / radialSegments) * 2 * Math.PI;
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
    for (let i = 0; i < numpoints; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const v = circleVertices[i][j];
        vertices.push(v.x, v.y, v.z);
      }
    }

    const indices = [];
    for (let i = 0; i < numpoints - 1; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const a = i * radialSegments + j;
        const b = i * radialSegments + ((j + 1) % radialSegments);
        const c = (i + 1) * radialSegments + ((j + 1) % radialSegments);
        const d = (i + 1) * radialSegments + j;

        indices.push(a, b, d, b, c, d);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(geometry, tubeMat);
    this.scene.add(mesh);
  }

  addSphere(position, radius = 0.9) {
    const geometry = new THREE.SphereGeometry(radius, 12, 12);
    const material = new THREE.MeshStandardMaterial({
      color: 0x654321,
      roughness: 0.8,
      metalness: 0.2
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(position);
    this.scene.add(sphere);
  }
}
