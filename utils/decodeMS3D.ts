import { BinaryReader } from '../src/helpers/BinaryReader.ts';

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

interface SurfaceDef {
  indices: Uint16Array;
}

export interface MS3DMesh {
  position: Float32Array;
  normal: Float32Array;
  uv: Float32Array;
  flatIndices: Uint16Array;
  surfaces: SurfaceDef[];
}

export function decodeMS3D(rawFile: ArrayBuffer): MS3DMesh {
  const f = new BinaryReader(rawFile);
  // console.debug(f.readFixedString(14));
  f.offset = 14;

  const numVertices = f.readShort();
  const verticesRaw = new Float32Array(numVertices * 3);
  for (let i = 0; i < numVertices; i++) {
    f.offset += 1;

    const vx = f.readFloat();
    const vy = f.readFloat();
    const vz = f.readFloat();
    f.offset += 2;

    const p = i * 3;
    verticesRaw[p] = vx;
    verticesRaw[p + 1] = vy;
    verticesRaw[p + 2] = vz;
  }

  const vertexLookup: VertDef[] = [];
  const numTriangles = f.readShort();
  const triangles: Uint16Array = new Uint16Array(numTriangles * 3);

  const findVertex = (
    index: number,
    normalX: number,
    normalY: number,
    normalZ: number,
    texU: number,
    texV: number,
  ) => {
    const posX = verticesRaw[index * 3];
    const posY = verticesRaw[index * 3 + 1];
    const posZ = verticesRaw[index * 3 + 2];

    const id = vertexLookup.findIndex(
      (v) =>
        v.x === posX &&
        v.y === posY &&
        v.z === posZ &&
        v.nx === normalX &&
        v.ny === normalY &&
        v.nz === normalZ &&
        v.u === texU &&
        v.v === texV,
    );
    if (id !== -1) {
      return id;
    }
    vertexLookup.push({
      x: posX,
      y: posY,
      z: posZ,
      nx: normalX,
      ny: normalY,
      nz: normalZ,
      u: texU,
      v: texV,
    });

    return vertexLookup.length - 1;
  };

  for (let i = 0; i < numTriangles; i++) {
    f.offset += 2;

    const idx1 = f.readShort();
    const idx2 = f.readShort();
    const idx3 = f.readShort();

    const nx1 = f.readFloat();
    const ny1 = f.readFloat();
    const nz1 = f.readFloat();
    const nx2 = f.readFloat();
    const ny2 = f.readFloat();
    const nz2 = f.readFloat();
    const nx3 = f.readFloat();
    const ny3 = f.readFloat();
    const nz3 = f.readFloat();

    const u1 = f.readFloat();
    const u2 = f.readFloat();
    const u3 = f.readFloat();
    const v1 = f.readFloat();
    const v2 = f.readFloat();
    const v3 = f.readFloat();

    f.offset += 2;

    const p = i * 3;
    triangles[p] = findVertex(idx1, nx1, ny1, nz1, u1, v1);
    triangles[p + 1] = findVertex(idx2, nx2, ny2, nz2, u2, v2);
    triangles[p + 2] = findVertex(idx3, nx3, ny3, nz3, u3, v3);
  }

  const position: Float32Array = new Float32Array(vertexLookup.length * 3);
  const normal: Float32Array = new Float32Array(vertexLookup.length * 3);
  const uv: Float32Array = new Float32Array(vertexLookup.length * 2);
  for (let i = 0; i < vertexLookup.length; i++) {
    const v = vertexLookup[i];
    const p = i * 3;
    const t = i * 2;

    position[p] = v.x;
    position[p + 1] = v.y;
    position[p + 2] = v.z;

    normal[p] = v.nx;
    normal[p + 1] = v.ny;
    normal[p + 2] = v.nz;

    uv[t] = v.u;
    uv[t + 1] = v.v;
  }

  const surfaces: SurfaceDef[] = [];
  const numSurfaces = f.readShort();
  for (let j = 0; j < numSurfaces; j++) {
    f.offset += 33;

    const numSurfTris = f.readShort();
    const surTris = new Uint16Array(numSurfTris * 3);
    for (let i = 0; i < numSurfTris; i++) {
      const idx = f.readShort() * 3;
      const p = i * 3;
      surTris[p] = triangles[idx];
      surTris[p + 1] = triangles[idx + 1];
      surTris[p + 2] = triangles[idx + 2];
    }
    f.offset += 1;

    surfaces.push({
      indices: surTris,
    });
  }

  const flatIndices = new Uint16Array(
    surfaces.reduce((prev, surf) => prev + surf.indices.length, 0),
  );

  let indexOff = 0;
  for (const surf of surfaces) {
    for (let i = 0; i < surf.indices.length; i++) {
      flatIndices[indexOff + i] = surf.indices[i];
    }
    indexOff += surf.indices.length;
  }

  return {
    position,
    normal,
    uv,
    flatIndices,
    surfaces,
  };
}
