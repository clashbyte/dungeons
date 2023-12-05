import TILE_DIFFUSE from '../assets/tiles/lt_diff.jpg?url';
import TILE_NORMAL from '../assets/tiles/lt_norm.jpg?url';
import TILE_DATA from '../assets/tiles/tile.set?url';
import { BinaryReader } from '../helpers/BinaryReader.ts';
import { loadTexture } from '../helpers/GLHelpers.ts';

interface TileDef {
  offset: number;
  mesh: TileMesh | null;
}
export interface TileMesh {
  vertices: number[];
  indices: number[];
}

type TileDictionary = { [key: string]: TileDef[][] };

export class TilesManager {
  private static rawBuffer: ArrayBuffer;

  private static reader: BinaryReader;

  private static list: TileDictionary = {};

  private static diffuseTexture: WebGLTexture;

  private static normalTexture: WebGLTexture;

  public static async preload() {
    const [buffer, diffuse, normal] = await Promise.all([
      !this.rawBuffer ? this.fetchTileset() : Promise.resolve(null),
      !this.diffuseTexture ? loadTexture(TILE_DIFFUSE) : Promise.resolve(null),
      !this.normalTexture ? loadTexture(TILE_NORMAL) : Promise.resolve(null),
    ]);

    if (!this.rawBuffer && buffer) {
      this.rawBuffer = buffer;
      this.reader = new BinaryReader(this.rawBuffer);
      this.list = {};

      this.reader.offset += 4;
      const count = this.reader.readShort();
      for (let i = 0; i < count; i++) {
        const nameSize = this.reader.readShort();
        const name = this.reader.readFixedString(nameSize);
        const group = this.reader.readByte();
        const variant = this.reader.readByte();
        const offset = this.reader.offset;
        const vcount = this.reader.readShort();
        this.reader.offset += vcount * (5 * 4 + 6);
        const icount = this.reader.readShort();
        this.reader.offset += icount * 2;

        if (!this.list[name]) {
          this.list[name] = [];
        }
        if (!this.list[name][group]) {
          this.list[name][group] = [];
        }
        this.list[name][group][variant] = {
          offset,
          mesh: null,
        };
      }
      console.debug(this.list);
    }

    if (!this.diffuseTexture && diffuse) {
      this.diffuseTexture = diffuse;
    }
    if (!this.normalTexture && normal) {
      this.normalTexture = normal;
    }
  }

  public static getTile(name: string, group: number, variant: number) {
    if (this.list[name][group]) {
      const def = this.list[name][group][variant];
      if (def) {
        if (!def.mesh) {
          def.mesh = this.parseEntity(name, group, variant);
        }

        return def.mesh;
      }
    }

    return null;
  }

  public static getTextures() {
    return [this.diffuseTexture, this.normalTexture] as const;
  }

  private static parseEntity(name: string, group: number, variant: number): TileMesh | null {
    const def = this.list[name][group][variant];
    if (def) {
      const f = this.reader;
      f.offset = def.offset;

      const vertices: number[] = [];
      const vcount = f.readShort();
      for (let i = 0; i < vcount; i++) {
        const x = f.readSignedShort();
        const y = f.readSignedShort();
        const z = f.readSignedShort();
        // const lng = f.readByte();
        // const lat = f.readByte();

        const nx = f.readFloat();
        const ny = f.readFloat();
        const nz = f.readFloat();
        const u = f.readFloat();
        const v = f.readFloat();

        vertices.push(
          x / 1000, //
          y / 1000,
          z / 1000,
          nx,
          ny,
          nz,

          // Math.cos(lat) * Math.sin(lng),
          // Math.cos(lng),
          // Math.sin(lat) * Math.sin(lng),

          u,
          v,
        );
      }

      const icount = f.readShort();
      const indices: number[] = [];
      for (let i = 0; i < icount; i++) {
        indices[i] = f.readShort();
      }

      return {
        vertices,
        indices,
      };
    }

    return null;
  }

  private static async fetchTileset() {
    const req = await fetch(TILE_DATA);

    return req.arrayBuffer();
  }
}
