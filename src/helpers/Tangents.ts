import { vec2, vec3 } from 'gl-matrix';

export function buildTangents(vertData: number[], indexData: number[]) {
  const vertexSize = 8;
  const nverts = vertData.length / 8;
  const tan1: vec3[] = Array(nverts)
    .fill(0)
    .map(() => vec3.create());
  const tan2: vec3[] = Array(nverts)
    .fill(0)
    .map(() => vec3.create());

  const v0 = vec3.create();
  const v1 = vec3.create();
  const v2 = vec3.create();
  const vu0 = vec2.create();
  const vu1 = vec2.create();
  const vu2 = vec2.create();
  const ds = vec3.create();
  const dt = vec3.create();

  const handleTri = (vert0: number, vert1: number, vert2: number) => {
    const id0 = vert0 * vertexSize;
    const id1 = vert1 * vertexSize;
    const id2 = vert2 * vertexSize;

    vec3.set(v0, vertData[id0], vertData[id0 + 1], vertData[id0 + 2]);
    vec3.set(v1, vertData[id1], vertData[id1 + 1], vertData[id1 + 2]);
    vec3.set(v2, vertData[id2], vertData[id2 + 1], vertData[id2 + 2]);

    vec2.set(vu0, vertData[id0 + 6], vertData[id0 + 7]);
    vec2.set(vu1, vertData[id1 + 6], vertData[id1 + 7]);
    vec2.set(vu2, vertData[id2 + 6], vertData[id2 + 7]);

    vec3.sub(v1, v1, v0);
    vec3.sub(v2, v2, v0);

    vec2.sub(vu1, vu1, vu0);
    vec2.sub(vu2, vu2, vu0);

    const r = 1.0 / (vu1[0] * vu2[1] - vu2[0] * vu1[1]);
    if (!isFinite(r)) {
      return;
    }

    vec3.copy(ds, v1);
    vec3.scale(ds, ds, vu2[1]);
    vec3.scaleAndAdd(ds, ds, v2, -vu1[1]);
    vec3.scale(ds, ds, r);

    vec3.copy(dt, v2);
    vec3.scale(dt, dt, vu1[0]);
    vec3.scaleAndAdd(dt, dt, v1, -vu2[0]);
    vec3.scale(dt, dt, r);

    vec3.add(tan1[vert0], tan1[vert0], ds);
    vec3.add(tan1[vert1], tan1[vert1], ds);
    vec3.add(tan1[vert2], tan1[vert2], ds);

    vec3.add(tan2[vert0], tan2[vert0], dt);
    vec3.add(tan2[vert1], tan2[vert1], dt);
    vec3.add(tan2[vert2], tan2[vert2], dt);
  };

  for (let i = 0; i < indexData.length; i += 3) {
    handleTri(i, i + 1, i + 2);
  }

  const tmp = vec3.create();
  const tmp2 = vec3.create();
  const n = vec3.create();
  const n2 = vec3.create();
  const out: number[] = [];

  const handleVertex = (vertex: number) => {
    const v = vertex * vertexSize;
    vec3.set(n, vertData[v + 3], vertData[v + 4], vertData[v + 5]);
    vec3.copy(n2, n);

    const t = tan1[vertex];
    vec3.scale(n, n, vec3.dot(n, t));
    vec3.sub(tmp, t, n);
    vec3.normalize(tmp, tmp);

    vec3.cross(tmp2, n2, t);

    const test = vec3.dot(tmp2, tan2[vertex]);
    const w = test < 0.0 ? -1 : 1;
    out[vertex * 3] = tmp[0] * -w;
    out[vertex * 3 + 1] = tmp[1] * -w;
    out[vertex * 3 + 2] = tmp[2] * -w;
  };

  for (let i = 0; i < nverts; i++) {
    handleVertex(i);
  }

  return out;
}
