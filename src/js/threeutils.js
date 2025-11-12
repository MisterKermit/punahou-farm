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
  addCone(scene, { position, radius = 0.2, height = 2 }) {
    const geometry = new THREE.ConeGeometry(radius, height);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff_ff_00,
      roughness: 1
    });
    const cone = new THREE.Mesh(geometry, material);
    cone.position.copy(position);

    return scene.add(cone);
  },
  drawSpline(branch) {
    const splinePoints = branch?.rootPoints || branch?.stemPoints;
    if (splinePoints.length > 0) {
      const curve = new THREE.CatmullRomCurve3(
        splinePoints,
        false,
        'catmullrom',
        1
      );
      const points = curve.getPoints(splinePoints.length * 5);

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

export default ThreeUtils;
