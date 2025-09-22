import * as THREE from 'three';
import { VerticalTiltShiftShader } from 'three/examples/jsm/Addons.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

class KDNode {
  constructor(point) {
    this.point = point;
    this.children = [];
  }
}

export default class AnimatedRootSystem {
  constructor(
    scene,
    {
      depth = 6,
      baseBranchLength = 5,
      spread = 2,
      maxChildren = 20,
      branchDecay = 0.8,
      branchChance = 0.75,
      growthSpeed = 0 // ms between new branches
    } = {}
  ) {
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
    console.log(
      'update: growthQueue.length =',
      this.growthQueue.length,
      'lastGrowthTime =',
      this.lastGrowthTime
    );

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

    branchLength = Math.random() * this.baseBranchLength;
    const numChildren = Math.floor(Math.random() * this.maxChildren);

    console.log('growNode: Creating', numChildren, 'children at depth', depth);

    for (let i = 0; i < this.maxChildren; i++) {
      const branch = [];
      let positionPointer = node.point.clone();
      for (let j = 0; j < depth; j++) {
        // branchLength *= Math.random() + 0.5; // slight random variation
        const dx = (Math.random() - 0.5) * this.spread;
        const dz = (Math.random() - 0.5) * this.spread;
        const dy = -branchLength * (0.2 + Math.random() * 0.4);

        const childPoint = new THREE.Vector3(
          positionPointer.x + dx,
          positionPointer.y + dy,
          positionPointer.z + dz
        );

        positionPointer = childPoint.clone();

        const child = new KDNode(childPoint);

        branch.push(child);

        // draw visuals
        this.addSphere(childPoint, 0.1 * (depth / this.depth) + 0.05);

        // push to growth queue for later expansion
        // this.growthQueue.push([child, depth - 1, branchLength * this.branchDecay]);
        console.log(
          'growNode: Added child to growthQueue, new length =',
          this.growthQueue.length
        );
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
        const curve = new THREE.CatmullRomCurve3(
          pointlocations,
          false,
          'catmullrom',
          0.3
        );
        const points = curve.getPoints(50);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
        const curveObject = new THREE.Line(geometry, material);
        // this.scene.add(curveObject);
        this.addRootCapsule(curve);
      }
    }
  }

  addSphere(position, radius = 0.3) {
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

  addRootCapsule(curve) {
    let texSize = 512;
    let points = curve.getSpacedPoints(texSize - 1);
    let frames = curve.computeFrenetFrames(texSize - 1);

    let data = [];
    points.forEach((p) => data.push(p.x, p.y, p.z, 0));
    frames.tangents.forEach((t) => data.push(t.x, t.y, t.z, 0));

    let dataTex = new THREE.DataTexture(
      new Float32Array(data),
      texSize,
      2,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    dataTex.needsUpdate = true;

    // === Capsule geometry ===
    let r = 0.1,
      rsegs = 12,
      csegs = 100;
    let capsuleGeo = mergeGeometries([
      new THREE.SphereGeometry(
        r,
        rsegs,
        Math.floor(rsegs * 0.5),
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.5
      ).translate(0, 0.5, 0),
      new THREE.CylinderGeometry(r, r, 1, rsegs, csegs, true),
      new THREE.SphereGeometry(
        r,
        rsegs,
        Math.floor(rsegs * 0.5),
        0,
        Math.PI * 2,
        Math.PI * 0.5,
        Math.PI * 0.5
      ).translate(0, -0.5, 0)
    ]).rotateX(-Math.PI * 0.5);

    // === Material with custom vertex shader to bend along curve ===
    let uniforms = {
      curveTex: { value: dataTex },
      stretchRatio: { value: 1.0 }
    };

    let mat = new THREE.MeshLambertMaterial({
      color: 0x88ccff,
      onBeforeCompile: (shader) => {
        shader.uniforms.curveTex = uniforms.curveTex;
        shader.uniforms.stretchRatio = uniforms.stretchRatio;

        shader.vertexShader =
          `
          uniform sampler2D curveTex;
          uniform float stretchRatio;

          mat3 calcLookAtMatrix(vec3 origin, vec3 target, float roll) {
            vec3 rr = vec3(sin(roll), cos(roll), 0.0);
            vec3 ww = normalize(target - origin);
            vec3 uu = normalize(cross(ww, rr));
            vec3 vv = normalize(cross(uu, ww));
            return -mat3(uu, vv, ww);
          }
        ` + shader.vertexShader;

        shader.vertexShader = shader.vertexShader.replace(
          `#include <beginnormal_vertex>`,
          `#include <beginnormal_vertex>
          
            vec3 pos = position;
            float u = clamp(pos.z + 0.5, 0., 1.) * stretchRatio;

            vec3 cpos = vec3(texture(curveTex, vec2(u, 0.25)));
            vec3 ctan = vec3(texture(curveTex, vec2(u, 0.75)));

            mat3 rot = calcLookAtMatrix(vec3(0), -ctan, 0.0);

            objectNormal = normalize(rot * objectNormal);
          `
        );

        shader.vertexShader = shader.vertexShader.replace(
          `#include <begin_vertex>`,
          `#include <begin_vertex>
            transformed = rot * pos;
            transformed += cpos;
          `
        );
      }
    });

    // === Capsule mesh ===
    let capsule = new THREE.Mesh(capsuleGeo, mat);
    capsule.frustumCulled = false;
    this.scene.add(capsule);
  }
}
