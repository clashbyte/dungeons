import { mat4, quat, vec3 } from 'gl-matrix';
import SKIN_DATA from '../assets/skins/skin.set?url';
import { GL } from '../core/GL.ts';
import { BinaryReader } from '../helpers/BinaryReader.ts';
import { createIndexBuffer, createVertexBuffer } from '../helpers/GLHelpers.ts';

export interface SkinSurface {
  vertices: WebGLBuffer;
  joints?: WebGLBuffer;
  weights?: WebGLBuffer;
  indices: WebGLBuffer;
  indexCount: number;
}

export interface SkinNode {
  name: string;
  position: vec3;
  rotation: quat;
  scale: vec3;
  parent: SkinNode | null;
  children: SkinNode[];
  matrix: mat4;
  invMatrix: mat4;
}

export interface Skin {
  nodes: SkinNode[];
  surfaces: { [key: string]: SkinSurface };
}

interface MeshDef {
  offset: number;
  length: number;
  skin: Skin | null;
}

export interface SkinAnimationFrame {
  time: number;
  position?: vec3;
  rotation?: quat;
  scale?: vec3;
  positionStep?: boolean;
  rotationStep?: boolean;
  scaleStep?: boolean;
}

export interface SkinAnimation {
  length: number;
  nodes: {
    [name: string]: SkinAnimationFrame[];
  };
}

export class SkinManager {
  private static rawBuffer: ArrayBuffer;

  private static reader: BinaryReader;

  private static stringLookup: string[];

  private static readonly meshes: { [key: string]: MeshDef } = {};

  private static readonly animations: { [key: string]: SkinAnimation } = {};

  public static async preload() {
    const [buffer] = await Promise.all([
      !this.rawBuffer ? this.fetchSkinSet() : Promise.resolve(null), //
    ]);

    if (!this.rawBuffer && buffer) {
      this.stringLookup = [];
      this.rawBuffer = buffer;
      this.reader = new BinaryReader(this.rawBuffer);

      const f = this.reader;
      f.offset += 4;

      const stringCount = f.readShort();
      for (let i = 0; i < stringCount; i++) {
        this.stringLookup.push(f.readString());
      }

      const meshCount = f.readShort();
      for (let i = 0; i < meshCount; i++) {
        const name = f.readString();
        const length = f.readInt();
        this.meshes[name] = {
          offset: f.offset,
          length,
          skin: null,
        };
        f.offset += length;
      }

      const animCount = f.readShort();
      for (let an = 0; an < animCount; an++) {
        const name = f.readString();
        const length = f.readFloat();
        const nodeCount = f.readShort();
        const anim: SkinAnimation = {
          length,
          nodes: {},
        };
        this.animations[name] = anim;

        for (let node = 0; node < nodeCount; node++) {
          const nameIndex = f.readShort();
          const nodeName = this.stringLookup[nameIndex];
          const frameCount = f.readShort();
          const frames: SkinAnimationFrame[] = [];

          for (let fr = 0; fr < frameCount; fr++) {
            const time = f.readFloat();
            const mask = f.readByte();

            const frame: SkinAnimationFrame = {
              time,
            };

            if ((mask & 1) === 1) {
              frame.position = f.readVec3();
            }
            if ((mask & 2) === 2) {
              frame.rotation = f.readQuat();
            }
            if ((mask & 4) === 4) {
              frame.scale = f.readVec3();
            }
            if ((mask & 8) === 8) {
              frame.positionStep = true;
            }
            if ((mask & 16) === 16) {
              frame.rotationStep = true;
            }
            if ((mask & 32) === 32) {
              frame.scaleStep = true;
            }

            frames.push(frame);
          }

          anim.nodes[nodeName] = frames;
        }
      }
    }
  }

  public static getSkin(name: string) {
    const def = this.meshes[name];
    if (!def.skin) {
      this.cacheSkin(name);
    }

    return def.skin!;
  }

  public static getAnimation(name: string) {
    return this.animations[name];
  }

  private static cacheSkin(name: string) {
    const def = this.meshes[name];
    const f = this.reader;
    f.offset = def.offset;

    const nodeCount = f.readShort();
    const nodes: SkinNode[] = [];
    const nodeParents: number[] = [];
    for (let i = 0; i < nodeCount; i++) {
      const nodeName = this.stringLookup[f.readShort()];
      const parent = f.readSignedShort();
      const position = f.readVec3();
      const rotation = f.readQuat();
      const scale = f.readVec3();

      nodes[i] = {
        name: nodeName,
        parent: null,
        children: [],
        position,
        rotation,
        scale,
        matrix: mat4.create(),
        invMatrix: mat4.create(),
      };
      nodeParents[i] = parent;
    }
    for (let i = 0; i < nodeCount; i++) {
      const pid = nodeParents[i];
      if (pid !== -1) {
        nodes[i].parent = nodes[pid];
        nodes[pid].children.push(nodes[i]);
      }
    }

    const nodeTasks = nodes.filter((n) => n.parent === null);
    while (nodeTasks.length > 0) {
      const node = nodeTasks.shift();
      if (node) {
        mat4.fromRotationTranslationScale(node.matrix, node.rotation, node.position, node.scale);
        if (node.parent) {
          mat4.multiply(node.matrix, node.parent.matrix, node.matrix);
        }
        mat4.invert(node.invMatrix, node.matrix);

        if (node.children.length) {
          nodeTasks.push(...node.children);
        }
      }
    }

    const skin: Skin = {
      nodes,
      surfaces: {},
    };
    const surfCount = f.readShort();
    for (let i = 0; i < surfCount; i++) {
      const surfName = f.readString();
      f.offset++;

      const vertCount = f.readShort();
      const vertData = f.readArrayBytes(vertCount * 8 * 4);
      const jointData = f.readArrayBytes(vertCount * 4);
      const weightData = f.readArrayBytes(vertCount * 4 * 4);

      const triCount = f.readShort();
      const indexData = f.readArrayBytes(triCount * 3 * 2);

      skin.surfaces[surfName] = {
        vertices: createVertexBuffer(vertData, GL.STATIC_DRAW),
        joints: createVertexBuffer(jointData, GL.STATIC_DRAW),
        weights: createVertexBuffer(weightData, GL.STATIC_DRAW),
        indices: createIndexBuffer(new Uint16Array(indexData.buffer)),
        indexCount: triCount * 3,
      };
    }

    def.skin = skin;
  }

  private static async fetchSkinSet() {
    const req = await fetch(SKIN_DATA);

    return req.arrayBuffer();
  }
}
