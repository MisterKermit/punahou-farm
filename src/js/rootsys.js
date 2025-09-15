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
    baseBranchLength = 4,
    spread = 3,
    maxChildren = 10,
    branchDecay = 1,
    branchChance = 1,
    growthSpeed = 2 // ms between new branches
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

    for (let i = 0; i < numChildren; i++) {
      const dx = (Math.random() - 0.5) * this.spread * (depth / this.depth);
      const dz = (Math.random() - 0.5) * this.spread * (depth / this.depth);
      const dy = -branchLength * (0.8 + Math.random() * 0.4);

      const childPoint = new THREE.Vector3(
        node.point.x + dx,
        node.point.y + dy,
        node.point.z + dz
      );

      const child = new KDNode(childPoint);
      node.children.push(child);

      // draw visuals
      this.drawLine(node.point, childPoint);
      this.addSphere(childPoint, 0.25 * (depth / this.depth) + 0.05);

      // push to growth queue for later expansion
      this.growthQueue.push([child, depth - 1, branchLength * this.branchDecay]);
      console.log('growNode: Added child to growthQueue, new length =', this.growthQueue.length);
    }
  }

  drawLine(p1, p2) {
    const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    const material = new THREE.LineBasicMaterial({ color: 0x8b4513 });
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);
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
