/* eslint no-await-in-loop: 0 */
import * as fs from 'fs';
import * as path from 'node:path';
import * as ini from 'ini';
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

function writeAnimation(
  f: BinaryWriter,
  model: GLTFModel,
  nodeNames: string[],
  animIndex: number,
  nameHint?: string,
) {
  const anim = model.animations[animIndex];
  f.writeString(nameHint || anim.name);
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

function writeTexture(f: BinaryWriter, texture: ArrayBuffer, name: string) {
  f.writeString(name);
  f.writeInt(texture.byteLength);

  const data = new Uint8Array(texture);
  for (let i = 0; i < data.length; i++) {
    f.writeByte(data[i]);
  }
}

(async () => {
  const buffer = new ArrayBuffer(20 * 1024 * 1024);
  const f = new BinaryWriter(buffer);
  const config = ini.parse(fs.readFileSync(path.resolve('raw_files/skins/skins.ini'), 'utf-8'));
  const meshFiles: { [name: string]: GLTFModel } = {};
  const animationFiles: { [name: string]: { file: GLTFModel; name: string } } = {};
  const textureFiles: { [name: string]: ArrayBuffer } = {};

  const nodeNames: string[] = [];
  for (const name in config.SKINS) {
    const file = fs.readFileSync(path.resolve(`raw_files/skins/${config.SKINS[name]}`)).buffer;
    const mesh = decodeGLTF(file);
    meshFiles[name] = mesh;
    for (const n of mesh.nodes) {
      if (!nodeNames.includes(n.name)) {
        nodeNames.push(n.name);
      }
    }
  }
  for (const name in config.ANIMATIONS) {
    const [meshName, animName] = config.ANIMATIONS[name].split('@');
    const file = fs.readFileSync(path.resolve(`raw_files/skins/${meshName}`)).buffer;
    const mesh = decodeGLTF(file);
    animationFiles[name] = {
      file: decodeGLTF(file),
      name:
        animName && mesh.animations.find((anim) => anim.name === animName)
          ? animName
          : mesh.animations[0].name,
    };
    for (const n of mesh.nodes) {
      if (!nodeNames.includes(n.name)) {
        nodeNames.push(n.name);
      }
    }
  }
  for (const name in config.TEXTURES) {
    const file = fs.readFileSync(path.resolve(`raw_files/skins/${config.TEXTURES[name]}`)).buffer;
    textureFiles[name] = file;
  }

  f.writeFixedString('SKIN');
  f.writeShort(nodeNames.length);
  for (const nn of nodeNames) {
    f.writeString(nn);
  }

  f.writeShort(Object.keys(meshFiles).length);
  for (const name in meshFiles) {
    const mesh = meshFiles[name];
    writeMesh(f, mesh, name, nodeNames);
  }

  f.writeShort(Object.keys(animationFiles).length);
  for (const name in animationFiles) {
    const mesh = animationFiles[name];
    writeAnimation(
      f,
      mesh.file,
      nodeNames,
      mesh.file.animations.findIndex((anim) => anim.name === mesh.name),
      name,
    );
  }

  f.writeShort(Object.keys(textureFiles).length);
  for (const name in textureFiles) {
    writeTexture(f, textureFiles[name], name);
  }

  const outBuffer = new DataView(buffer, 0, f.offset);
  fs.writeFileSync(path.resolve('src/assets/skins/skin.set'), outBuffer, {});

  // eslint-disable-next-line no-console
  console.info('[INFO] Written skin set');
})();
