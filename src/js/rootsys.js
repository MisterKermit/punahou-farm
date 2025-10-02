import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

class RootSegment {
  constructor(start, end, rootPoints) {
    this.start = start;
    this.end = end;
    this.rootPoints = rootPoints; // array of THREE.Vector3
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
    this.startRadius = 2.0
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
    console.log('update: growthQueue.length =', this.growthQueue.length, 'lastGrowthTime =', this.lastGrowthTime);

    // add one branch per tick (controlled by growthSpeed)
    if (this.growthQueue.length > 0) {
      this.lastGrowthTime = 0;
      const [node, depth, branchLength] = this.growthQueue.shift();
      console.log('Growing node at depth', depth, 'branchLength', branchLength);

      if (depth < this.maxDepth) {
        this.growNode(node, depth, branchLength);
      }
    }
  }

  growNode(node, depth, branchLength) {
    if (depth < 0) return;

    const childPoints = [];

    const homePoint = node.point.clone();

    childPoints.push(homePoint);
    
    const currentPos = node.point.clone();

    for (let currentDepth = depth; currentDepth <= depth + this.maxDepth; currentDepth++) {
      
      const randomLength = branchLength * (0.7 + Math.random() * 0.6); // vary length a bit

      const dx = (Math.random() - 0.5) * this.spread; // small left/right
      const dy = -Math.abs(Math.random() * this.spread * 2); // always negative, larger magnitude for downward growth
      const dz = (Math.random() - 0.5) * this.spread; // small forward/back

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

      const endPoint = new KDNode(endPosVector, radius, currentDepth);
      
      childPoints.push(endPosVector);

      if (currentDepth === depth + this.maxDepth) {
        childPoints.push(endPosVector);
        const branch = new RootSegment(homePoint, endPoint, childPoints);
        this.drawSpline(branch);
        this.growthQueue.push([endPoint, currentDepth, homePoint.distanceTo(endPosVector)]);
      }

      currentPos.copy(endPosVector);

      this.addSphere(endPosVector, 0.1);
    }
  }

  drawSpline(branch) {
    // Build array of THREE.Vector3: parent + all children
    // for (let i = 0; i < childPoints.length; i++) {
    //   const pointlocations = [nodePoint];

    //   childPoints[i].forEach((kdNode) => {
    //     if (kdNode && kdNode.point) {
    //       pointlocations.push(kdNode.point);
    //     }
    //   });

    //   if (pointlocations.length > 1) {
    //     const curve = new THREE.CatmullRomCurve3(pointlocations, false, 'catmullrom', 0.3);
    //     const points = curve.getPoints(50);
    //     const geometry = new THREE.BufferGeometry().setFromPoints(points);
    //     const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
    //     const curveObject = new THREE.Line(geometry, material);
    //     this.scene.add(curveObject);
    //     // this.addRootCapsule(curve);
    //   }
    // }
    if (branch.rootPoints.length > 0) {
        const curve = new THREE.CatmullRomCurve3(branch.rootPoints, false, 'catmullrom', 0.3);
        const points = curve.getPoints(50);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
        const curveObject = new THREE.Line(geometry, material);
        this.scene.add(curveObject);
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
