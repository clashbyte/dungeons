import { buildTangents } from '../../helpers/Tangents.ts';
import { TilesManager } from '../../managers/TilesManager.ts';
import { DecoratedLink, DecoratedRoom, DecoratedTile } from '../room/RoomGenerator.ts';
import { WallType } from '../room/SimpleRoomGenerator.ts';
import {
  LightDef,
  LightDefType,
  MeshLink,
  MeshOutlinePart,
  MeshRoom,
  MeshSurface,
  RoomTriangulator,
} from './RoomTriangulator.ts';

export class SimpleRoomTriangulator extends RoomTriangulator {
  public constructor(rooms: DecoratedRoom[], links: DecoratedLink[]) {
    super(rooms, links);
  }

  public triangulate() {
    for (const base of this.baseRooms) {
      const room: MeshRoom = {
        decoratedRoom: base,
        vertexData: [],
        indexData: [],
        lights: [],
        indexCount: 0,
      };
      for (const tile of base.tiles) {
        this.placeTile(
          room,
          tile.x,
          tile.y,
          tile.height ?? 0,
          tile.angle ?? 0,
          tile.name,
          tile.group,
          tile.variant,
        );
      }
      if (base.outlines) {
        room.outline = this.buildOutline(base, base.outlines);
      }
      room.lights = this.scanLights(base.tiles, base);
      room.tangentData = buildTangents(room.vertexData, room.indexData);
      this.rooms.push(room);
    }
    for (const base of this.baseLinks) {
      const link: MeshLink = {
        decoratedLink: base,
        vertexData: [],
        indexData: [],
        indexCount: 0,
      };
      for (const tile of base.tiles) {
        this.placeTile(
          link,
          tile.x,
          tile.y,
          tile.height ?? 0,
          tile.angle ?? 0,
          tile.name,
          tile.group,
          tile.variant,
        );
      }
      if (base.outlines) {
        link.outline = this.buildOutline(base, base.outlines);
      }
      link.tangentData = buildTangents(link.vertexData, link.indexData);
      this.links.push(link);
    }
  }

  private placeTile(
    room: MeshRoom | MeshLink,
    x: number,
    y: number,
    height: number,
    angle: number,
    name: string,
    group: number,
    variant: number,
  ) {
    const t = TilesManager.getTile(name, group, variant);
    if (t) {
      const vcount = room.vertexData.length / 8;

      let xoff;
      let yoff;
      if ('decoratedRoom' in room) {
        xoff = room.decoratedRoom.generatorRoom.x;
        yoff = room.decoratedRoom.generatorRoom.y;
      } else {
        xoff = room.decoratedLink.generatorLink.x;
        yoff = room.decoratedLink.generatorLink.y;
      }

      for (let i = 0; i < t.vertices.length; i += 8) {
        const [vx, vy, vz, vnx, vny, vnz, u, v] = t.vertices.slice(i, i + 8);
        const rot = (Math.PI / 2) * (angle + 2);
        const sin = Math.sin(rot);
        const cos = Math.cos(rot);

        const px = vx * cos - vz * sin + x + 0.5 + xoff;
        const py = vy + height;
        const pz = vx * sin + vz * cos + y + 0.5 + yoff;
        const nx = vnx * cos - vnz * sin;
        const nz = vnx * sin + vnz * cos;

        room.vertexData.push(px, py, pz, nx, vny, nz, u, v);
      }

      room.indexData.push(...t.indices.map((idx) => idx + vcount));
      room.indexCount += t.indices.length;
    }
  }

  private buildOutline(room: DecoratedRoom | DecoratedLink, lines: MeshOutlinePart[]): MeshSurface {
    const HEIGHT = 1.565;
    const position: number[] = [];
    const indices: number[] = [];
    let xoff;
    let yoff;
    if ('generatorRoom' in room) {
      xoff = room.generatorRoom.x;
      yoff = room.generatorRoom.y;
    } else {
      xoff = room.generatorLink.x;
      yoff = room.generatorLink.y;
    }

    let cnt = 0;
    for (const line of lines) {
      position.push(
        line.x1 + xoff,
        HEIGHT,
        line.y1 + yoff,
        line.x2 + xoff,
        HEIGHT,
        line.y2 + yoff,
        line.x1 + xoff,
        0,
        line.y1 + yoff,
        line.x2 + xoff,
        0,
        line.y2 + yoff,
      );
      indices.push(cnt, cnt + 2, cnt + 1, cnt + 1, cnt + 2, cnt + 3);
      cnt += 4;
    }

    return {
      vertexData: position,
      indexData: indices,
      indexCount: indices.length,
    };
  }

  private scanLights(tiles: DecoratedTile[], room: DecoratedRoom) {
    const lights: LightDef[] = [];
    for (const t of tiles) {
      if (t.name === 'wall' && t.variant === WallType.Torch) {
        const dist = 0.55;
        const angle = -(t.angle ?? 0) * (Math.PI / 2);
        const x = t.x + room.generatorRoom.x + Math.sin(angle) * dist + 0.5;
        const y = t.y + room.generatorRoom.y + Math.cos(angle) * dist + 0.5;
        const height = 1.4;
        lights.push({
          x,
          y,
          height,
          type: LightDefType.WallTorch,
        });
      } else if (t.name === 'fireplace') {
        const height = 1.4;
        lights.push({
          x: t.x + room.generatorRoom.x + 0.5,
          y: t.y + room.generatorRoom.y + 0.5,
          height,
          type: LightDefType.Fireplace,
        });
      }
    }

    return lights;
  }
}
