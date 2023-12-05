import { vec3 } from 'gl-matrix';

interface VertDef {
  x: number;
  y: number;
  z: number;
  u: number;
  v: number;
  nx: number;
  ny: number;
  nz: number;
}

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface Vector2 {
  x: number;
  y: number;
}

export interface OBJMesh {
  position: Float32Array;
  normal: Float32Array;
  uv: Float32Array;
  indices: Uint16Array;
}

export function flatShade(mesh: OBJMesh): OBJMesh {
  const pos: number[] = [];
  const norm: number[] = [];
  const uv: number[] = [];
  const indx: number[] = [];

  const tcount = mesh.indices.length;
  for (let i = 0; i < tcount; i += 3) {
    const id0 = mesh.indices[i];
    const id1 = mesh.indices[i + 1];
    const id2 = mesh.indices[i + 2];

    const v0 = vec3.fromValues(
      mesh.position[id0 * 3],
      mesh.position[id0 * 3 + 1],
      mesh.position[id0 * 3 + 2],
    );
    const v1 = vec3.fromValues(
      mesh.position[id1 * 3],
      mesh.position[id1 * 3 + 1],
      mesh.position[id1 * 3 + 2],
    );
    const v2 = vec3.fromValues(
      mesh.position[id2 * 3],
      mesh.position[id2 * 3 + 1],
      mesh.position[id2 * 3 + 2],
    );

    const vs1 = vec3.create();
    const vs2 = vec3.create();

    vec3.sub(vs1, v1, v0);
    vec3.sub(vs2, v2, v0);

    const n = vec3.create();
    vec3.cross(n, vs1, vs2);
    vec3.normalize(n, n);

    pos.push(v0[0], v0[1], v0[2], v1[0], v1[1], v1[2], v2[0], v2[1], v2[2]);

    norm.push(n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2]);

    uv.push(
      mesh.uv[id0 * 2],
      mesh.uv[id0 * 2 + 1],
      mesh.uv[id1 * 2],
      mesh.uv[id1 * 2 + 1],
      mesh.uv[id2 * 2],
      mesh.uv[id2 * 2 + 1],
    );

    indx.push(i, i + 1, i + 2);
  }

  return {
    position: new Float32Array(pos),
    normal: new Float32Array(norm),
    uv: new Float32Array(uv),
    indices: new Uint16Array(indx),
  };
}

export function decodeOBJ(rawText: string): OBJMesh {
  const verts: VertDef[] = [];
  const positions: Vector3[] = [];
  const normals: Vector3[] = [];
  const uvs: Vector2[] = [];
  const indices: number[] = [];

  const pickVert = (vertID: number, normalID: number, uvID: number) => {
    const vert = positions[vertID - 1];
    const norm = normals[normalID - 1];
    const uv = uvs[uvID - 1];

    const idx = verts.findIndex(
      (v) =>
        v.x === vert.x &&
        v.y === vert.y &&
        v.z === vert.z &&
        v.nx === norm.x &&
        v.ny === norm.y &&
        v.nz === norm.z &&
        v.u === uv.x &&
        v.y === uv.y,
    );

    if (idx !== -1) {
      return idx;
    }
    verts.push({
      x: vert.x,
      y: vert.y,
      z: vert.z,

      nx: norm.x,
      ny: norm.y,
      nz: norm.z,

      u: uv.x,
      v: uv.y,
    });

    return verts.length - 1;
  };

  const lines = rawText.split(/\r?\n/);
  for (const lineRaw of lines) {
    let line = lineRaw;
    if (line.includes('#')) {
      line = line.substring(0, line.indexOf('#'));
    }

    if (line.trim().length > 0) {
      const parts = line.split(' ');
      const command = parts.shift()!.toLowerCase();
      switch (command) {
        case 'v':
          {
            const [vx, vy, vz] = parts.filter((s) => s.length > 0).map((s) => Number(s));
            positions.push({
              x: vx,
              y: vy,
              z: vz,
            });
          }
          break;

        case 'vn':
          {
            const [vx, vy, vz] = parts.filter((s) => s.length > 0).map((s) => Number(s));
            normals.push({
              x: vx,
              y: vy,
              z: vz,
            });
          }
          break;

        case 'vt':
          {
            const [vx, vy] = parts.filter((s) => s.length > 0).map((s) => Number(s));
            uvs.push({
              x: vx,
              y: vy,
            });
          }
          break;

        case 'f':
          {
            const list = parts
              .filter((s) => s.length > 0)
              .map((s) => s.split('/').map((ss) => Number(ss)))
              .map((grp) => pickVert(grp[0], grp[2], grp[1]));
            const v0 = list.shift()!;
            for (let i = 0; i < list.length - 1; i++) {
              indices.push(v0, list[i], list[i + 1]);
            }
          }
          break;
      }
    }
  }

  const position = new Float32Array(verts.length * 3);
  const normal = new Float32Array(verts.length * 3);
  const uv = new Float32Array(verts.length * 2);
  for (let i = 0; i < verts.length; i++) {
    const v3 = i * 3;
    const v2 = i * 2;

    position[v3] = verts[i].x;
    position[v3 + 1] = verts[i].y;
    position[v3 + 2] = verts[i].z;

    normal[v3] = verts[i].nx;
    normal[v3 + 1] = verts[i].ny;
    normal[v3 + 2] = verts[i].nz;

    uv[v2] = verts[i].u;
    uv[v2 + 1] = -verts[i].v;
  }

  return {
    position,
    normal,
    uv,
    indices: new Uint16Array(indices),
  };
}
