import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { metalness } from 'three/tsl';

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
    startingBranches = 5
  } = {}) {
    this.scene = scene;

    // parameters
    this.maxDepth = maxDepth;
    this.baseBranchLength = baseBranchLength;
    this.startRadius = 0.3
    this.spread = spread;
    this.maxChildren = maxChildren;
    this.branchDecay = branchDecay;
    this.branchChance = branchChance;
    this.growthSpeed = growthSpeed;
    this.startingBranches = startingBranches;
    // root node at origin
    this.root = new KDNode(new THREE.Vector3(0, 0, 0), this.startRadius, 0);
    this.addSphere(this.root.point, 0.6);

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
    // Debug: log growth queue length and lastGrowthTime
    // console.log('update: growthQueue.length =', this.growthQueue.length, 'lastGrowthTime =', this.lastGrowthTime);

    // add one branch per tick (controlled by growthSpeed)
    if (this.growthQueue.length > 0) {
      this.lastGrowthTime = 0;
      const [node, depth, branchLength] = this.growthQueue.shift();
      // console.log('Growing node at depth', depth, 'branchLength', branchLength);

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

    radii.push(node.radius)
    
    const currentPos = node.point.clone();

    for (let currentDepth = depth + 1; currentDepth <= depth + this.maxDepth; currentDepth++) {
      
      const randomLength = branchLength * (0.7 + Math.random() * 0.6); // vary length a bit

      const dx = (Math.random() * 2 - 1) * this.spread * 0.2; // small left/right
      const dy = -Math.abs(Math.random() * this.spread); // always negative, larger magnitude for downward growth
      const dz = (Math.random() * 2 - 1) * this.spread * 0.2; // small forward/back

      const dirVector = new THREE.Vector3(
        dx,
        dy,
        dz
      ).normalize();


      /*
        Potential for additional noise in growth direction 
        i.e influence future nosie function that changes based on environment tweaks
      */
      const noiseVector = new THREE.Vector3(
        (Math.random() - 0.5) * this.spread,
        (Math.random() - 0.5) * this.spread,
        -(Math.random() - 0.5) * this.spread
      ).normalize();
      
      // const endPosVector = currentPos.clone().add(dirVector.multiplyScalar(randomLength)).add(noiseVector);

      const endPosVector = currentPos.clone().add(dirVector.multiplyScalar(randomLength))

    
      const radius = this.startRadius * (1/currentDepth);
      console.log('radius at depth', currentDepth, 'is', radius);
      

      const endPoint = new KDNode(endPosVector, radius, currentDepth);
      
      childPoints.push(endPosVector);

      radii.push(radius);

      if (currentDepth === depth + this.maxDepth) {
        // childPoints.push(endPosVector);
        // radii.push()
        const branch = new RootSegment(homePoint, endPoint, childPoints, radii);
        this.drawSpline(branch);
        this.growthQueue.push([endPoint, currentDepth, homePoint.distanceTo(endPosVector)]);
      }

      currentPos.copy(endPosVector);

      this.addSphere(endPosVector, 0.1);
    }
  }

  drawSpline(branch) {
    if (branch.rootPoints.length > 0) {
        const curve = new THREE.CatmullRomCurve3(branch.rootPoints, false, 'catmullrom', 1);
        const points = curve.getPoints(branch.rootPoints.length * 5);

        const tubeGeom = new THREE.TubeGeometry(curve, 64, 0.05, 8, false);
        const tubeMat = new THREE.MeshDepthMaterial({
          color: 0xffffff,
          roughness: 0.6, 
          metalness: 0
        });

        const curveObject = new THREE.Mesh(tubeGeom, tubeMat);
        this.scene.add(curveObject);

        this.genRootMesh(points, curve, branch.branchRadii);
    }
  }

  genRootMesh(curvePoints, curve, radius) {
    const radialSegments = 20;
    const numpoints = curvePoints.length;

    const radiusLength = radius.length;

    // Create a CatmullRomCurve3 from the points
    // const curve = new THREE.CatmullRomCurve3(curvePoints, false, 'catmullrom', 1);

    // Get Frenet frames for the curve
    const frames = curve.computeFrenetFrames(numpoints, false);

    // For visualization: draw small spheres at each circle point
    for (let i = 0; i < numpoints; i++) {
      const u = i / (numpoints - 1);
      const pos = curve.getPointAt(u);

      // Example: radius can be constant or vary along the curve
      const t = (radiusLength - 1) * u;
      const lower = Math.floor(t);
      const upper = Math.min(lower + 1, radiusLength - 1);
      const frac = t - lower;
      const posRadius = radius[lower] * (1 - frac) + radius[upper] * frac;
      
      const tangent = frames.tangents[i];
      const normal = frames.normals[i];
      const binormal = frames.binormals[i];

      for (let j = 0; j < radialSegments; j++) {
        const v = j / radialSegments * 2 * Math.PI;
        // Negate so it faces outward
        const cx = -posRadius * Math.cos(v);
        const cy = posRadius * Math.sin(v);

        // Calculate circle point position
        const pos2 = pos.clone();
        pos2.x += cx * normal.x + cy * binormal.x;
        pos2.y += cx * normal.y + cy * binormal.y;
        pos2.z += cx * normal.z + cy * binormal.z;

        // Visualize: draw a small sphere at pos2
        this.addSphere(pos2, 0.02);
      }
    }
  }

  addSphere(position, radius = 0.9) {
    const geometry = new THREE.SphereGeometry(radius, 12, 12);
    const material = new THREE.MeshStandardMaterial({
      color: 0x654321,
      roughness: 0.8,
      metalness: 0.2,
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(position);
    this.scene.add(sphere);
  }
   
}
