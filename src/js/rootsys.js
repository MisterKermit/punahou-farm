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
    spread = 2,
    maxChildren = 20,
    branchDecay = 0.4,
    branchChance = 0.75,
    growthSpeed = 0 // ms between new branches
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

    // root node at origin
    this.root = new KDNode(new THREE.Vector3(0, 0, 0), this.startRadius, 0);
    // this.addSphere(this.root.point, 0.6);

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

      for (let children = 0; children < this.maxChildren; i++) {
        this.growNode(node, depth, branchLength);
      }

    }
  }

  

  growNode(node, depth, branchLength) {
    if (depth <= 0) return;

    const childPoints = [];


    for (let currentDepth = 1; currentDepth <= this.maxDepth; i++) {
      
      const currentPos = node.point.clone();
      const randomLength = branchLength * (0.7 + Math.random() * 0.6); // vary length a bit

      const dx = (Math.random() - 0.5) * this.spread;
      const dy = (Math.random() - 0.5) * this.spread;
      const dz = -(Math.random() - 0.5) * this.spread; // generally grow downwards

      const dirVector = new THREE.Vector3(
        dx,
        dy,
        dz
      ).normalize();

      const noiseVector = new THREE.Vector3(
        (Math.random() - 0.5) * randomLength,
        (Math.random() - 0.5) * randomLength,
        (Math.random() - 0.5) * randomLength
      );
      
      const endPosVector = currentPos.clone().add(dirVector.multiplyScalar(branchLength)).add(noiseVector);
      
      const radius = this.startRadius * (1/currentDepth);

      const endPoint = new KDNode(endPosVector, radius, currentDepth);

      const branch = new RootSegment(currentPos, endPoint, childPoints);
      
      
      this.growthQueue.push(endPoint, currentDepth, currentPos.distanceTo(endPosVector));

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
        const curve = new THREE.CatmullRomCurve3(pointlocations, false, 'catmullrom', 0.3);
        const points = curve.getPoints(50);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
        const curveObject = new THREE.Line(geometry, material);
        // this.scene.add(curveObject);
        this.addRootCapsule(curve);
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

  addRootCapsule(curve) {
    let texSize = 512;
    let points = curve.getSpacedPoints(texSize - 1);
    let frames = curve.computeFrenetFrames(texSize - 1);

    let data = [];
    points.forEach(p => data.push(p.x, p.y, p.z, 0));
    frames.tangents.forEach(t => data.push(t.x, t.y, t.z, 0));

    let dataTex = new THREE.DataTexture(new Float32Array(data), texSize, 2, THREE.RGBAFormat, THREE.FloatType);
    dataTex.needsUpdate = true;

    // === Capsule geometry ===
    let r = 0.1, rsegs = 12, csegs = 100;
    let capsuleGeo = mergeGeometries([
      new THREE.SphereGeometry(r, rsegs, Math.floor(rsegs * 0.5), 0, Math.PI * 2, 0, Math.PI * 0.5).translate(0, 0.5, 0),
      new THREE.CylinderGeometry(r, r * this.branchDecay, 1, rsegs, csegs, true),
      new THREE.SphereGeometry(r * this.branchDecay, rsegs, Math.floor(rsegs * 0.5), 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5).translate(0, -0.5, 0)
    ]).rotateX(-Math.PI * 0.5);

    // === Material with custom vertex shader to bend along curve ===
    let uniforms = {
      curveTex: { value: dataTex },
      stretchRatio: { value: 1.0 }
    };

    let mat = new THREE.MeshLambertMaterial({
      color: 0x88ccff,
      onBeforeCompile: shader => {
        shader.uniforms.curveTex = uniforms.curveTex;
        shader.uniforms.stretchRatio = uniforms.stretchRatio;

        shader.vertexShader = `
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
