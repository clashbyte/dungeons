import { StaticObject } from '@/entities/objects/StaticObject.ts';
import { DecoratedLink, DecoratedRoom, DecoratedTile } from '../room/RoomGenerator.ts';
import { WallType } from '../room/SimpleRoomGenerator.ts';
import {
  LightDef,
  LightDefType,
  RoomTriangulator,
  TriangulatedLink,
  TriangulatedOutlinePart,
  TriangulatedRoom,
  TriangulatedSurface,
} from './RoomTriangulator.ts';
import { buildTangents } from '@/helpers/Tangents.ts';
import { TilesManager } from '@/managers/TilesManager.ts';

export class SimpleRoomTriangulator extends RoomTriangulator {
  public constructor(rooms: DecoratedRoom[], links: DecoratedLink[]) {
    super(rooms, links);
  }

  public triangulate() {
    for (const base of this.baseRooms) {
      const room: TriangulatedRoom = this.createEmptyRoom(base);
      const outlineTiles: DecoratedTile[][] = Array(8)
        .fill(0)
        .map(() => []);

      for (const tile of base.tiles) {
        const [surf, outlineSurf] = this.detectSurfaceByTileName(tile, room);
        if (surf) {
          this.placeTile(
            surf,
            room.decoratedRoom.generatorRoom.x,
            room.decoratedRoom.generatorRoom.y,
            tile.x,
            tile.y,
            tile.height ?? 0,
            tile.angle ?? 0,
            tile.scale ?? 1,
            tile.name,
            tile.group,
            tile.variant,
          );
        }
        if (outlineSurf !== null) {
          outlineTiles[outlineSurf].push(tile);
        }
      }
      room.wallOutline = [];
      for (let i = 0; i < 8; i++) {
        room.wallOutline[i] = this.buildOutline(
          room.decoratedRoom,
          this.buildTilesOutline(outlineTiles[i]),
        );
      }
      room.lights = this.scanLights(base.tiles, base);
      for (const surf of [...room.walls, room.floor]) {
        surf.tangentData = buildTangents(surf.vertexData, surf.indexData);
      }

      for (const hint of base.sceneryTiles) {
        room.scenery.push(new StaticObject(room, this.rooms.length, hint));
      }
      this.rooms.push(room);
    }
    for (const base of this.baseLinks) {
      const link: TriangulatedLink = this.createEmptyLink(base);
      const outlineTiles: DecoratedTile[][] = Array(8)
        .fill(0)
        .map(() => []);

      for (const tile of base.tiles) {
        const [surf, outlineSurf] = this.detectSurfaceByTileName(tile, link);
        if (surf) {
          this.placeTile(
            surf,
            base.generatorLink.x,
            base.generatorLink.y,
            tile.x,
            tile.y,
            tile.height ?? 0,
            tile.angle ?? 0,
            tile.scale ?? 1,
            tile.name,
            tile.group,
            tile.variant,
          );
        }
        if (outlineSurf !== null) {
          outlineTiles[outlineSurf].push(tile);
        }
      }
      link.wallOutline = [];
      for (let i = 0; i < 8; i++) {
        link.wallOutline[i] = this.buildOutline(
          link.decoratedLink,
          this.buildTilesOutline(outlineTiles[i]),
        );
      }
      for (const surf of [...link.walls, link.floor]) {
        surf.tangentData = buildTangents(surf.vertexData, surf.indexData);
      }
      this.links.push(link);
    }
  }

  /**
   * Append tile mesh to room/link surface
   * @param surface Surface
   * @param offsetX Room/link offset on X axis
   * @param offsetY Room/link offset on Y axis
   * @param x Tile X
   * @param y Tile Y
   * @param height Tile elevation
   * @param angle Tile angle
   * @param scale Tile scale
   * @param name Tile mesh base name
   * @param group Tile mesh group
   * @param variant Tile mesh variant
   * @private
   */
  private placeTile(
    surface: TriangulatedSurface,
    offsetX: number,
    offsetY: number,
    x: number,
    y: number,
    height: number,
    angle: number,
    scale: number,
    name: string,
    group: number,
    variant: number,
  ) {
    const t = TilesManager.getTile(name, group, variant);
    if (t) {
      const vcount = surface.vertexData.length / 8;

      for (let i = 0; i < t.vertices.length; i += 8) {
        const [vx, vy, vz, vnx, vny, vnz, u, v] = t.vertices.slice(i, i + 8);
        const rot = (Math.PI / 2) * (angle + 2);
        const sin = Math.sin(rot);
        const cos = Math.cos(rot);

        const px = (vx * cos - vz * sin) * scale + x + 0.5 + offsetX;
        const py = vy * scale + height;
        const pz = (vx * sin + vz * cos) * scale + y + 0.5 + offsetY;
        const nx = vnx * cos - vnz * sin;
        const nz = vnx * sin + vnz * cos;

        surface.vertexData.push(px, py, pz, nx, vny, nz, u, v);
      }

      surface.indexData.push(...t.indices.map((idx) => idx + vcount));
      surface.indexCount += t.indices.length;
    }
  }

  private buildOutline(
    room: DecoratedRoom | DecoratedLink,
    lines: TriangulatedOutlinePart[],
  ): TriangulatedSurface {
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

  private createEmptyRoom(decoratedRoom: DecoratedRoom): TriangulatedRoom {
    return {
      decoratedRoom,
      scenery: [],
      floor: this.createEmptySurface(),
      walls: Array(8)
        .fill(0)
        .map(() => this.createEmptySurface()),
      lights: [],
      wallOutline: Array(8)
        .fill(0)
        .map(() => this.createEmptySurface()),
    };
  }

  private createEmptyLink(decoratedLink: DecoratedLink): TriangulatedLink {
    return {
      decoratedLink,
      floor: this.createEmptySurface(),
      walls: Array(8)
        .fill(0)
        .map(() => this.createEmptySurface()),
      wallOutline: Array(8)
        .fill(0)
        .map(() => this.createEmptySurface()),
    };
  }

  private createEmptySurface(): TriangulatedSurface {
    return {
      vertexData: [],
      tangentData: [],
      indexData: [],
      indexCount: 0,
    };
  }

  private detectSurfaceByTileName(
    tile: DecoratedTile,
    room: TriangulatedRoom | TriangulatedLink,
  ): readonly [TriangulatedSurface | null, number | null] {
    if (tile.name === 'floor') {
      return [room.floor, null];
    }
    if (tile.name === 'wall') {
      let px = 0;
      let py = 0;
      let roomW = 0;
      let roomH = 0;
      if ('decoratedRoom' in room) {
        roomW = room.decoratedRoom.generatorRoom.width;
        roomH = room.decoratedRoom.generatorRoom.height;
      } else {
        roomW =
          room.decoratedLink.generatorLink.x +
          (!room.decoratedLink.generatorLink.vertical
            ? room.decoratedLink.generatorLink.length
            : 1);
        roomH =
          room.decoratedLink.generatorLink.y +
          (room.decoratedLink.generatorLink.vertical ? room.decoratedLink.generatorLink.length : 1);
      }

      if (tile.x === -1) {
        px = 0;
      } else if (tile.x === roomW) {
        px = 2;
      } else {
        px = 1;
      }
      if (tile.y === -1) {
        py = 0;
      } else if (tile.y === roomH) {
        py = 2;
      } else {
        py = 1;
      }
      let idx = py * 3 + px;
      if (idx >= 4) {
        idx--;
      }

      return [room.walls[idx], idx];
    }

    return [null, null];
  }

  private buildTilesOutline(tiles: DecoratedTile[]) {
    const lines: TriangulatedOutlinePart[] = [];

    for (const tile of tiles) {
      if (
        tile.name === 'wall' &&
        tile.variant !== WallType.ThinJoin &&
        tile.variant !== WallType.Door
      ) {
        const sub: TriangulatedOutlinePart[] = [];
        switch (tile.variant as WallType) {
          case WallType.Normal:
          case WallType.NormalWithHole:
          case WallType.Torch:
          case WallType.NormalAccent:
            sub.push({
              x1: -0.5,
              y1: 0,
              x2: 0.5,
              y2: 0,
            });
            break;

          case WallType.OutsideCorner:
            sub.push(
              {
                x1: 0,
                y1: 0.5,
                x2: 0,
                y2: 0,
              },
              {
                x1: 0,
                y1: 0,
                x2: 0.5,
                y2: 0,
              },
            );
            break;

          case WallType.InsideCorner:
            sub.push(
              {
                x1: 0,
                y1: 0,
                x2: 0,
                y2: -0.5,
              },
              {
                x1: -0.5,
                y1: 0,
                x2: 0,
                y2: 0,
              },
            );
            break;

          case WallType.RoundInsideCorner:
            const STEPS = 4;
            const points: [number, number][] = [];
            for (let i = 0; i <= STEPS; i++) {
              const angle = ((Math.PI * 0.5) / STEPS) * i;
              points.push([Math.sin(angle) * 0.5 - 0.5, Math.cos(angle) * 0.5 - 0.5]);
            }

            for (let i = 1; i < points.length; i++) {
              sub.push({
                x1: points[i - 1][0],
                y1: points[i - 1][1],
                x2: points[i][0],
                y2: points[i][1],
              });
            }
            break;
        }

        if (sub.length !== 0) {
          const rot = (Math.PI / 2) * ((tile.angle ?? 0) + 2);
          const sin = Math.sin(rot);
          const cos = Math.cos(rot);

          for (const l of sub) {
            const x1 = l.x1;
            const y1 = l.y1;
            const x2 = l.x2;
            const y2 = l.y2;

            lines.push({
              x1: x1 * cos - y1 * sin + tile.x + 0.5,
              y1: x1 * sin + y1 * cos + tile.y + 0.5,
              x2: x2 * cos - y2 * sin + tile.x + 0.5,
              y2: x2 * sin + y2 * cos + tile.y + 0.5,
            });
          }
        }
      }
    }

    return lines;
  }
}
