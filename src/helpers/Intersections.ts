import { vec3 } from 'gl-matrix';

export function intersectRayPlane(
  out: vec3,
  rayOrigin: vec3,
  rayDirection: vec3,
  planeNormal: vec3,
  planeDist: number,
) {
  const denom = vec3.dot(rayDirection, planeNormal);
  if (denom !== 0) {
    const t = -(vec3.dot(rayOrigin, planeNormal) + planeDist) / denom;
    if (t < 0) {
      return false;
    }

    const v0 = vec3.create();
    vec3.scale(v0, rayDirection, t);
    vec3.add(out, rayOrigin, v0);

    return true;
  }
  if (vec3.dot(planeNormal, rayOrigin) + planeDist === 0) {
    vec3.copy(out, rayOrigin);

    return true;
  }

  return false;
}

export function intersectRayBox(
  out: vec3,
  rayOrigin: vec3,
  rayDirection: vec3,
  boxCenter: vec3,
  boxSize: vec3,
) {
  let tmin;
  let tmax;
  let tymin;
  let tymax;
  let tzmin;
  let tzmax;

  const bhalf = vec3.scale(vec3.create(), boxSize, 0.5);
  const bmin = vec3.subtract(vec3.create(), boxCenter, bhalf);
  const bmax = vec3.add(vec3.create(), boxCenter, bhalf);

  const invdirx = 1 / rayDirection[0];
  const invdiry = 1 / rayDirection[1];
  const invdirz = 1 / rayDirection[2];

  if (invdirx >= 0) {
    tmin = (bmin[0] - rayOrigin[0]) * invdirx;
    tmax = (bmax[0] - rayOrigin[0]) * invdirx;
  } else {
    tmin = (bmax[0] - rayOrigin[0]) * invdirx;
    tmax = (bmin[0] - rayOrigin[0]) * invdirx;
  }

  if (invdiry >= 0) {
    tymin = (bmin[1] - rayOrigin[1]) * invdiry;
    tymax = (bmax[1] - rayOrigin[1]) * invdiry;
  } else {
    tymin = (bmax[1] - rayOrigin[1]) * invdiry;
    tymax = (bmin[1] - rayOrigin[1]) * invdiry;
  }

  if (tmin > tymax || tymin > tmax) {
    return null;
  }

  if (tymin > tmin || isNaN(tmin)) {
    tmin = tymin;
  }

  if (tymax < tmax || isNaN(tmax)) {
    tmax = tymax;
  }

  if (invdirz >= 0) {
    tzmin = (bmin[2] - rayOrigin[2]) * invdirz;
    tzmax = (bmax[2] - rayOrigin[2]) * invdirz;
  } else {
    tzmin = (bmax[2] - rayOrigin[2]) * invdirz;
    tzmax = (bmin[2] - rayOrigin[2]) * invdirz;
  }

  if (tmin > tzmax || tzmin > tmax) {
    return null;
  }

  if (tzmin > tmin || isNaN(tmin)) {
    tmin = tzmin;
  }

  if (tzmax < tmax || isNaN(tmax)) {
    tmax = tzmax;
  }

  if (tmax < 0) {
    return null;
  }

  vec3.scaleAndAdd(out, rayOrigin, rayDirection, tmin >= 0 ? tmin : tmax);

  return true;
}
