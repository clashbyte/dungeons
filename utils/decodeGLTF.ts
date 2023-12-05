import { mat4, quat, vec2, vec3 } from 'gl-matrix';
import { BinaryReader } from '../src/helpers/BinaryReader.ts';
import { GLTF } from './GLTF.ts';

const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

const ACCESSOR_BYTE = 5120;
const ACCESSOR_UBYTE = 5121;
const ACCESSOR_SHORT = 5122;
const ACCESSOR_USHORT = 5123;
const ACCESSOR_UINT = 5125;
const ACCESSOR_FLOAT = 5126;

const ACCESSOR_SIZE: { [key: number]: number } = {
  5120: 1,
  5121: 1,
  5122: 2,
  5123: 2,
  5125: 4,
  5126: 4,
};

const ACCESSOR_COMPONENTS: { [key: string]: number } = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};

interface BufferDef {
  buffer: ArrayBuffer;
  offset: number;
  length: number;
}

interface KeyframeDef {
  time: number;
  position?: vec3;
  rotation?: quat;
  scale?: vec3;
  positionStep: boolean;
  rotationStep: boolean;
  scaleStep: boolean;
}

interface AnimationDef {
  name: string;
  length: number;
  nodes: KeyframeDef[][];
}

interface HeaderData {
  data: GLTF;
  buffers: BufferDef[];
}

interface Node {
  name: string;
  children: Node[];
  parent: Node | null;
  position: vec3;
  rotation: quat;
  scale: vec3;
  matrix: mat4;
  mesh?: number;
}

interface SurfaceData {
  name: string;
  vertices: number[];
  indices: number[];
  joints?: number[];
  weights?: number[];
}

export interface GLTFModel {
  surfaces: SurfaceData[];
  nodes: Node[];
  animations: AnimationDef[];
  skinRoot: number;
}

function decodeHeader(f: BinaryReader) {
  // const magic = f.readFixedString(4);
  f.offset += 4;
  const version = f.readUInt();
  f.offset += 4;

  const header: HeaderData = {
    data: {
      asset: {
        version: version.toString(),
      },
    },
    buffers: [],
  };
  while (f.offset < f.length) {
    const chunkLength = f.readUInt();
    const type = f.readUInt();
    switch (type) {
      case CHUNK_JSON:
        const data = f.readFixedString(chunkLength);
        header.data = JSON.parse(data) ?? {};
        break;

      case CHUNK_BIN:
        header.buffers.push({
          buffer: f.buffer,
          offset: f.offset,
          length: chunkLength,
        });
        f.offset += chunkLength;
        break;

      default:
        f.offset += chunkLength;
        break;
    }
  }

  return header;
}

function readNodeTree(data: GLTF) {
  const nodes: Node[] = [];
  if (data.nodes) {
    for (const base of data.nodes) {
      const position = vec3.fromValues(0, 0, 0);
      const rotation = quat.identity(quat.create());
      const scale = vec3.fromValues(1, 1, 1);
      if (base.matrix) {
        mat4.getTranslation(position, base.matrix as mat4);
        mat4.getRotation(rotation, base.matrix as mat4);
        mat4.getScaling(scale, base.matrix as mat4);
      }
      if (base.translation) {
        vec3.copy(position, base.translation as vec3);
      }
      if (base.rotation) {
        quat.copy(rotation, base.rotation as quat);
      }
      if (base.scale) {
        vec3.copy(scale, base.scale as vec3);
      }

      const node: Node = {
        name: base.name ? (base.name as string) : '',
        position,
        rotation,
        scale,
        parent: null,
        children: base.children ? base.children.map((id) => nodes[id]) : [],
        matrix: mat4.create(),
        mesh: base.mesh,
      };
      nodes.push(node);
    }
  }

  for (const node of nodes) {
    for (const child of node.children) {
      child.parent = node;
    }
  }

  const nodeTasks = nodes.filter((node) => node.parent === null);
  while (nodeTasks.length > 0) {
    const node = nodeTasks.shift();
    if (node) {
      mat4.fromRotationTranslationScale(node.matrix, node.rotation, node.position, node.scale);
      if (node.parent) {
        mat4.multiply(node.matrix, node.parent.matrix, node.matrix);
      }
      if (node.children.length) {
        nodeTasks.push(...node.children);
      }
    }
  }

  return nodes;
}

function decodeAccessor(
  data: GLTF,
  buffers: BufferDef[],
  index: number | undefined,
): readonly [
  Int8Array | Uint8Array | Int16Array | Uint16Array | Uint32Array | Float32Array,
  number,
] {
  if (index !== undefined) {
    const accessor = data.accessors ? data.accessors[index] : null;
    if (accessor) {
      const bufferView = data.bufferViews ? data.bufferViews[accessor.bufferView!] : null;
      if (bufferView) {
        const offset =
          (bufferView.byteOffset ?? 0) +
          (accessor.byteOffset ?? 0) +
          buffers[bufferView.buffer].offset;
        const itemCount = accessor.count;
        const byteSize = ACCESSOR_SIZE[accessor.componentType];
        const componentCount = ACCESSOR_COMPONENTS[accessor.type];
        const stride = byteSize * componentCount;
        const finalSize = itemCount * stride;

        const rawData = buffers[bufferView.buffer].buffer.slice(offset, offset + finalSize);
        switch (accessor.componentType) {
          case ACCESSOR_BYTE:
            return [new Int8Array(rawData), componentCount] as const;

          case ACCESSOR_UBYTE:
            return [new Uint8Array(rawData), componentCount] as const;

          case ACCESSOR_SHORT:
            return [new Int16Array(rawData), componentCount] as const;

          case ACCESSOR_USHORT:
            return [new Uint16Array(rawData), componentCount] as const;

          case ACCESSOR_UINT:
            return [new Uint32Array(rawData), componentCount] as const;

          case ACCESSOR_FLOAT:
            return [new Float32Array(rawData), componentCount] as const;
        }
      }
    }
  }

  return [new Float32Array(), 1] as const;
}

function transformMeshes(data: GLTF, nodes: Node[], buffers: BufferDef[]) {
  // const matrices = nodes.map((node) => node.matrix);
  // const normalMatrices = matrices.map((baseMat) => mat3.normalFromMat4(mat3.create(), baseMat));
  const meshes: SurfaceData[] = [];
  let skinRoot = -1;

  if (data.meshes) {
    for (let meshID = 0; meshID < data.meshes.length; meshID++) {
      const base = data.meshes[meshID];
      const nodeID = nodes.findIndex((n) => n.mesh === meshID);
      const baseNode = data.nodes![nodeID]!;

      let skinData: number[] | undefined = undefined;
      if (baseNode.skin !== undefined) {
        skinData = data.skins![baseNode.skin ?? 0].joints!;
        const parentID = nodes.indexOf(nodes[nodeID].parent!);
        if (skinRoot !== parentID && skinRoot !== -1) {
          console.debug('wrong root');
        }
        skinRoot = parentID;
      }
      const vertexData: number[] = [];
      const weightData: number[] = [];
      const jointData: number[] = [];
      const indexData: number[] = [];
      let vertexCount = 0;

      for (const surf of base.primitives) {
        const [positionBuffer] = decodeAccessor(data, buffers, surf.attributes.POSITION);
        const [normalBuffer] = decodeAccessor(data, buffers, surf.attributes.NORMAL);
        const [uvBuffer] = decodeAccessor(data, buffers, surf.attributes.TEXCOORD_0);
        const [jointBuffer] = decodeAccessor(data, buffers, surf.attributes.JOINTS_0);
        const [weightBuffer, jointBoneCount] = decodeAccessor(
          data,
          buffers,
          surf.attributes.WEIGHTS_0,
        );

        for (let i = 0; i < positionBuffer.length / 3; i++) {
          const v2 = i * 2;
          const v3 = i * 3;
          const v4 = i * jointBoneCount;

          const pos = vec3.fromValues(
            positionBuffer[v3], //
            positionBuffer[v3 + 1],
            positionBuffer[v3 + 2],
          );
          const norm = vec3.fromValues(
            normalBuffer[v3] ?? 0, //
            normalBuffer[v3 + 1] ?? 0,
            normalBuffer[v3 + 2] ?? 1,
          );
          const uv = vec2.fromValues(
            uvBuffer[v2] ?? 0, //
            uvBuffer[v2 + 1] ?? 0,
          );

          const joints = [nodeID, 0, 0, 0];
          const weights = [1, 0, 0, 0];
          if (jointBuffer && weightBuffer) {
            for (let p = 0; p < jointBoneCount; p++) {
              joints[p] = jointBuffer[v4 + p];
              weights[p] = weightBuffer[v4 + p];
              if (skinData) {
                joints[p] = skinData[joints[p]];
              }
            }
          }

          const totalWeight = weights.reduce((prev, current) => prev + current, 0);
          if (totalWeight < 0.9999) {
            console.debug('w', totalWeight);
          }

          // vec3.transformMat4(pos, pos, matrices[node]);
          // vec3.transformMat3(norm, norm, normalMatrices[node]);
          // vec3.normalize(norm, norm);

          vertexData.push(pos[0], pos[1], pos[2], norm[0], norm[1], norm[2], uv[0], uv[1]);
          weightData.push(...weights);
          jointData.push(...joints);
        }

        if (surf.indices) {
          const [indexBuffer] = decodeAccessor(data, buffers, surf.indices);
          for (let i = 0; i < indexBuffer.length; i++) {
            indexData.push(indexBuffer[i] + vertexCount);
          }
        } else {
          throw new Error('No indices');
        }
        vertexCount = vertexData.length / 8;
      }

      meshes.push({
        name: nodes[nodeID].name,
        vertices: vertexData,
        joints: jointData,
        weights: weightData,
        indices: indexData,
      });
    }
  }

  return [meshes, skinRoot] as const;
}

function decodeAnimations(data: GLTF, buffers: BufferDef[]) {
  const animations: AnimationDef[] = [];
  if (data.animations) {
    for (const base of data.animations) {
      const nodeData: {
        position?: number;
        rotation?: number;
        scale?: number;
      }[] = [];

      for (const channel of base.channels) {
        const sampler = channel.sampler;
        const { node: nodeID, path } = channel.target;
        if (nodeID !== undefined) {
          if (!nodeData[nodeID]) {
            nodeData[nodeID] = {};
          }

          switch (path) {
            case 'translation':
              nodeData[nodeID].position = sampler;
              break;

            case 'rotation':
              nodeData[nodeID].rotation = sampler;
              break;

            case 'scale':
              nodeData[nodeID].scale = sampler;
              break;
          }
        }
      }

      const tracks: KeyframeDef[][] = [];
      for (let i = 0; i < nodeData.length; i++) {
        const { position: positionID, rotation: rotationID, scale: scaleID } = nodeData[i];
        const nodeFrames: KeyframeDef[] = [];

        for (const [id, target] of [
          [positionID, 'position'] as const,
          [rotationID, 'rotation'] as const,
          [scaleID, 'scale'] as const,
        ]) {
          if (id !== undefined) {
            const sampler = base.samplers[id];
            const [frameTime] = decodeAccessor(data, buffers, sampler.input);
            const [frameData, stride] = decodeAccessor(data, buffers, sampler.output);
            for (let j = 0; j < frameTime.length; j++) {
              const off = j * stride;
              const time = frameTime[j];

              let frame = nodeFrames.find((f) => f.time === time);
              if (!frame) {
                frame = {
                  time,
                  positionStep: false,
                  rotationStep: false,
                  scaleStep: false,
                };
                nodeFrames.push(frame);
              }
              frame![`${target}Step`] = sampler.interpolation === 'STEP';
              frame![target] = (
                target === 'rotation'
                  ? quat.fromValues(
                      frameData[off],
                      frameData[off + 1],
                      frameData[off + 2],
                      frameData[off + 3],
                    )
                  : vec3.fromValues(frameData[off], frameData[off + 1], frameData[off + 2])
              ) as Float32Array;
            }
          }
        }
        nodeFrames.sort((f1, f2) => f1.time - f2.time);
        tracks.push(nodeFrames);
      }

      let min = Infinity;
      let max = -Infinity;
      for (const track of tracks) {
        for (const frame of track) {
          min = Math.min(min, frame.time);
          max = Math.max(max, frame.time);
        }
      }
      for (const track of tracks) {
        for (const frame of track) {
          frame.time -= min;
        }
      }

      animations.push({
        length: max - min,
        name: base.name,
        nodes: tracks,
      });
    }
  }

  return animations;
}

export function decodeGLTF(rawFile: ArrayBuffer): GLTFModel {
  const f = new BinaryReader(rawFile);

  const { data, buffers: bufferDefs } = decodeHeader(f);
  const nodes = readNodeTree(data);
  const [surfaces, skinRoot] = transformMeshes(data, nodes, bufferDefs);
  const animations = decodeAnimations(data, bufferDefs);

  return {
    surfaces,
    animations,
    nodes,
    skinRoot,
  };
}
