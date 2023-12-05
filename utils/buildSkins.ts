/* eslint no-await-in-loop: 0 */
import * as fs from 'fs';
import * as path from 'node:path';
import { BinaryWriter } from './BinaryWriter.ts';
import { decodeGLTF, GLTFModel } from './decodeGLTF.ts';

function writeMesh(f: BinaryWriter, model: GLTFModel, fileName: string, nodeNames: string[]) {
  f.writeString(fileName.replace('.glb', ''));
  f.offset += 4;
  const start = f.offset;

  // Write nodes
  f.writeShort(model.nodes.length);
  for (const node of model.nodes) {
    f.writeShort(nodeNames.indexOf(node.name));
    f.writeSignedShort(node.parent ? model.nodes.indexOf(node.parent) : -1);
    f.writeVec3(node.position);
    f.writeQuat(node.rotation);
    f.writeVec3(node.scale);
  }

  // Write surfaces
  f.writeShort(model.surfaces.length);
  for (const surf of model.surfaces) {
    const mask =
      (surf.vertices ? 1 : 0) + //
      (surf.vertices ? 2 : 0) +
      (surf.weights && surf.joints ? 4 : 0);

    const vertCount = surf.vertices.length / 8;
    const triCount = surf.indices.length / 3;
    f.writeString(surf.name);
    f.writeByte(mask);

    f.writeShort(vertCount);
    for (let i = 0; i < surf.vertices.length; i++) {
      f.writeFloat(surf.vertices[i]);
    }
    if (surf.weights && surf.joints) {
      for (let i = 0; i < surf.joints.length; i++) {
        f.writeByte(surf.joints[i]);
      }
      for (let i = 0; i < surf.weights.length; i++) {
        f.writeFloat(surf.weights[i]);
      }
    }

    f.writeShort(triCount);
    for (let i = 0; i < surf.indices.length; i++) {
      f.writeShort(surf.indices[i]);
    }
  }

  const length = f.offset - start;
  const pos = f.offset;
  f.offset = start - 4;
  f.writeInt(length);
  f.offset = pos;
}

function writeAnimation(f: BinaryWriter, model: GLTFModel, nodeNames: string[], animIndex: number) {
  const anim = model.animations[animIndex];
  f.writeString(anim.name);
  f.writeFloat(anim.length);

  f.writeShort(anim.nodes.filter((t) => t.length > 0).length);

  for (let j = 0; j < anim.nodes.length; j++) {
    if (anim.nodes[j] && anim.nodes[j].length) {
      f.writeShort(nodeNames.indexOf(model.nodes[j].name));
      f.writeShort(anim.nodes[j].length);

      for (const frame of anim.nodes[j]) {
        const mask =
          (frame.position ? 1 : 0) + //
          (frame.rotation ? 2 : 0) +
          (frame.scale ? 4 : 0) +
          (frame.positionStep ? 8 : 0) +
          (frame.rotationStep ? 16 : 0) +
          (frame.scaleStep ? 32 : 0);

        f.writeFloat(frame.time);
        f.writeByte(mask);

        if (frame.position) {
          f.writeVec3(frame.position);
        }
        if (frame.rotation) {
          f.writeQuat(frame.rotation);
        }
        if (frame.scale) {
          f.writeVec3(frame.scale);
        }
      }
    }
  }
}

(async () => {
  const buffer = new ArrayBuffer(20 * 1024 * 1024);
  const f = new BinaryWriter(buffer);
  const modelList = fs
    .readdirSync(path.resolve('raw_files/skins'))
    .filter((p) => p.toLowerCase().endsWith('.glb'))
    .map((p) => [p, fs.readFileSync(path.resolve(`raw_files/skins/${p}`)).buffer] as const)
    .map(([fname, rawData]) => [fname, decodeGLTF(rawData)] as const);

  const nodeNames: string[] = [];
  for (const [, m] of modelList) {
    for (const n of m.nodes) {
      if (!nodeNames.includes(n.name)) {
        nodeNames.push(n.name);
      }
    }
  }

  let meshCount = 0;
  let animCount = 0;
  for (const [, m] of modelList) {
    if (m.surfaces.length > 0) {
      meshCount++;
    }
    if (m.animations.length) {
      animCount += m.animations.length;
    }
  }

  f.writeFixedString('SKIN');
  f.writeShort(nodeNames.length);
  for (const nn of nodeNames) {
    f.writeString(nn);
  }

  f.writeShort(meshCount);
  for (const [name, m] of modelList) {
    if (m.surfaces.length > 0) {
      writeMesh(f, m, name, nodeNames);
    }
  }

  f.writeShort(animCount);
  for (const [, m] of modelList) {
    if (m.animations.length > 0) {
      for (let i = 0; i < m.animations.length; i++) {
        writeAnimation(f, m, nodeNames, i);
      }
    }
  }

  const outBuffer = new DataView(buffer, 0, f.offset);
  fs.writeFileSync(path.resolve('src/assets/skins/skin.set'), outBuffer, {});

  // eslint-disable-next-line no-console
  console.info('[INFO] Written skin set');
})();
