import * as THREE from 'three';

class KDNode {
  constructor(point) {
    this.point = point;
    this.children = [];
  }
}

export default class AnimatedRootSystem {
  constructor(scene, {
    depth = 10,
    baseBranchLength = 10,
    spread = 5,
    maxChildren = 10,
    branchDecay = 1,
    branchChance = 1,
    growthSpeed = 0 // ms between new branches
  } = {}) {
    this.scene = scene;

    // parameters
    this.depth = depth;
    this.baseBranchLength = baseBranchLength;
    this.spread = spread;
    this.maxChildren = maxChildren;
    this.branchDecay = branchDecay;
    this.branchChance = branchChance;
    this.growthSpeed = growthSpeed;

    // root node at origin
    this.root = new KDNode(new THREE.Vector3(0, 0, 0));
    this.addSphere(this.root.point, 0.3);

    // growth queue (holds [node, depth, branchLength])
    this.growthQueue = [[this.root, depth, baseBranchLength]];

    // start animation
    this.lastGrowthTime = 0;
  }

  update(deltaTime) {
    this.lastGrowthTime += deltaTime;
    // Debug: log growth queue length and lastGrowthTime
    console.log('update: growthQueue.length =', this.growthQueue.length, 'lastGrowthTime =', this.lastGrowthTime);

    // add one branch per tick (controlled by growthSpeed)
    if (this.lastGrowthTime > this.growthSpeed && this.growthQueue.length > 0) {
      this.lastGrowthTime = 0;
      const [node, depth, branchLength] = this.growthQueue.shift();
      console.log('Growing node at depth', depth, 'branchLength', branchLength);
      this.growNode(node, depth, branchLength);
    }
  }

  growNode(node, depth, branchLength) {
    if (depth <= 0) return;
    if (Math.random() > this.branchChance) return;

    const numChildren = Math.floor(Math.random() * this.maxChildren) + 1;
    console.log('growNode: Creating', numChildren, 'children at depth', depth);
    for (let i = 0; i < this.maxChildren; i++) {
      const branch = []
      for (let j = 0; j < depth; j++) {
        // branchLength *= Math.random() + 0.5; // slight random variation
        const dx = (Math.random() - 0.5) * this.spread;
        const dz = (Math.random() - 0.5) * this.spread;
        const dy = -branchLength * (0.8 + Math.random() * 0.4);

        const childPoint = new THREE.Vector3(
          node.point.x + dx,
          node.point.y + dy,
          node.point.z + dz
        );

        const child = new KDNode(childPoint);

        branch.push(child);

        // draw visuals
        this.addSphere(childPoint, 0.1 * (depth / this.depth) + 0.05);

        // push to growth queue for later expansion
        // this.growthQueue.push([child, depth - 1, branchLength * this.branchDecay]);
        console.log('growNode: Added child to growthQueue, new length =', this.growthQueue.length);
      }
      node.children.push(branch);

      this.drawSpline(node.point, node.children);
    }

  }

  drawSpline(nodePoint, childPoints) {
    // Build array of THREE.Vector3: parent + all children
    for (let i = 0; i < childPoints.length; i++) {
      const pointlocations = [nodePoint];

      childPoints[i].forEach((kdNode) => {
        if (kdNode && kdNode.point) {
          pointlocations.push(kdNode.point);
        }
      });

      if (pointlocations.length > 1) {
        const curve = new THREE.CatmullRomCurve3(pointlocations);
        const points = curve.getPoints(50);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
        const curveObject = new THREE.Line(geometry, material);
        this.scene.add(curveObject);
      }
    }
  }

  addSphere(position, radius = 0.3) {
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
