/* eslint no-await-in-loop: 0 */
import * as fs from 'fs';
import * as path from 'node:path';
import { BinaryWriter } from './BinaryWriter.ts';
import { decodeOBJ, flatShade, OBJMesh } from './decodeOBJ.ts';

const SCALE = 500;

// TODO: book_A_A_01, book_A_B_01
async function writeMesh(f: BinaryWriter, fileName: string) {
  const modelFile = fs.readFileSync(path.resolve(`raw_files/tiles/${fileName}`), 'utf-8');
  let mesh: OBJMesh | null = null;
  try {
    mesh = decodeOBJ(modelFile); // decodeMS3D(modelFile);
  } catch (ex) {
    //
  }
  const [name, groupRaw, variantRaw] = fileName.split('_');
  const group = groupRaw.toUpperCase().charCodeAt(0) - 65;
  const variant = variantRaw.toUpperCase().charCodeAt(0) - 65;
  f.writeString(name);
  f.writeByte(group);
  f.writeByte(variant);

  if (mesh) {
    mesh = flatShade(mesh);

    const vcount = mesh.position.length / 3;
    f.writeShort(vcount);
    for (let i = 0; i < vcount; i++) {
      const vn = i * 3;
      const vt = i * 2;

      f.writeSignedShort(Math.round(mesh.position[vn] * SCALE));
      f.writeSignedShort(Math.round(mesh.position[vn + 1] * SCALE));
      f.writeSignedShort(Math.round(mesh.position[vn + 2] * SCALE));

      const nx = mesh.normal[vn];
      const ny = mesh.normal[vn + 1];
      const nz = mesh.normal[vn + 2];
      f.writeFloat(nx);
      f.writeFloat(ny);
      f.writeFloat(nz);
      // if (ny === 1) {
      //   f.writeByte(0);
      //   f.writeByte(0);
      // } else if (ny === -1) {
      //   f.writeByte(0);
      //   f.writeByte(128);
      // } else {
      //   const lat = ((Math.atan2(nz, nx) * 255) / (Math.PI * 2)) & 255;
      //   const lng = ((Math.acos(ny) * 255) / (Math.PI * 2)) & 255;
      //
      //   f.writeByte(lat);
      //   f.writeByte(lng);
      // }

      f.writeFloat(mesh.uv[vt]);
      f.writeFloat(mesh.uv[vt + 1]);
    }

    f.writeShort(mesh.indices.length);
    for (let i = 0; i < mesh.indices.length; i++) {
      f.writeShort(mesh.indices[i]);
    }
  } else {
    f.writeShort(0);
    f.writeShort(0);
  }
}

(async () => {
  const buffer = new ArrayBuffer(20 * 1024 * 1024);
  const f = new BinaryWriter(buffer);
  const fileList = fs
    .readdirSync(path.resolve('raw_files/tiles'))
    .filter((p) => p.toLowerCase().endsWith('_obj.obj'));

  f.writeFixedString('TILE');
  f.writeShort(fileList.length);
  for (const name of fileList) {
    await writeMesh(f, name);
  }

  const outBuffer = new DataView(buffer, 0, f.offset);
  fs.writeFileSync(path.resolve('src/assets/tiles/tile.set'), outBuffer, {});

  // eslint-disable-next-line no-console
  console.info('[INFO] Written tileset');
})();
