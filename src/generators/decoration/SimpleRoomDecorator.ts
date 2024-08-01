import Alea from 'alea';
import { clamp } from '../../helpers/MathUtils.ts';
import { GeneratorRoom, GeneratorTileType } from '../dungeon/DungeonGenerator.ts';
import { makeWarehouse } from '@/generators/decoration/patches/Warehouse.ts';

export enum LevelType {
  Church,
  Crypt,
  Castle,
  Basement,
  Cave,
}

export enum WallHintType {
  None,
  Torch,
  AccentWall,
  Window,
  SkipMesh,
}

export enum FloorHintType {
  None,
  LooseTile,
  Cracked,
  Fireplace,
  SkipMesh,
}

export interface SceneryTileHint {
  x: number;
  y: number;
  name: string;
  group: number;
  variant: number;
  solid?: boolean;
  angle?: number;
  scale?: number;
  height?: number;
}

export type WallHint =
  | {
      type: WallHintType.None;
    }
  | {
      type: WallHintType.Torch;
    }
  | {
      type: WallHintType.AccentWall;
    }
  | {
      type: WallHintType.Window;
    }
  | {
      type: WallHintType.SkipMesh;
    };

export type FloorHint =
  | {
      type: FloorHintType.None;
    }
  | {
      type: FloorHintType.LooseTile;
    }
  | {
      type: FloorHintType.Cracked;
    }
  | {
      type: FloorHintType.Fireplace;
    }
  | {
      type: FloorHintType.SkipMesh;
    };

export class SimpleRoomDecorator {
  private readonly random: () => number;

  public constructor(
    seed: string,
    private readonly theme: LevelType,
  ) {
    const alea = Alea(`${seed}_room`);
    this.random = () => alea.next();
  }

  public makeHintMap(
    room: GeneratorRoom,
  ): readonly [FloorHint[][], WallHint[][], SceneryTileHint[], boolean] {
    const floor: FloorHint[][] = Array(room.height)
      .fill(0)
      .map(() =>
        Array(room.width)
          .fill(0)
          .map(() => ({
            type: FloorHintType.None,
          })),
      );

    const walls: WallHint[][] = Array(room.height + 2)
      .fill(0)
      .map(() =>
        Array(room.width + 2)
          .fill(0)
          .map(() => ({
            type: WallHintType.None,
          })),
      );

    const scenery: SceneryTileHint[] = [];
    this.placeRandomFloor(room, floor);

    const area = room.width * room.height;
    if (area >= 24) {
      console.debug('large');
    } else {
      console.debug('small');

      makeWarehouse(this.random, room, floor, walls, scenery);
      // this.makeWarehouse(room, floor, walls, scenery);
    }

    this.placeTorches(room, floor, walls);

    return [floor, walls, scenery, this.random() < 0.5] as const;
  }

  private placeRandomFloor(room: GeneratorRoom, floor: FloorHint[][]) {
    if (this.theme === LevelType.Cave) {
      return;
    }
    const area = room.width * room.height;
    const crackQuota = Math.floor(area * 0.05);
    const brokenTileQuota = Math.floor(area * 0.2);
    for (let i = 0; i < crackQuota; i++) {
      const x = Math.floor(this.random() * room.width);
      const y = Math.floor(this.random() * room.height);
      floor[y][x] = {
        type: FloorHintType.Cracked,
      };
    }
    for (let i = 0; i < brokenTileQuota; i++) {
      const x = Math.floor(this.random() * room.width);
      const y = Math.floor(this.random() * room.height);
      floor[y][x] = {
        type: FloorHintType.LooseTile,
      };
    }
  }

  private placeTorches(room: GeneratorRoom, floor: FloorHint[][], walls: WallHint[][]) {
    const BLOCK_SIZE = 8;
    const blocksX = Math.ceil(room.width / BLOCK_SIZE);
    const blocksY = Math.ceil(room.height / BLOCK_SIZE);
    const sizeX = Math.ceil(room.width / blocksX);
    const sizeY = Math.ceil(room.height / blocksY);
    const sizeCX = Math.floor(sizeX / 2);
    const sizeCY = Math.floor(sizeY / 2);

    const placeWallTorch = (
      bx: number,
      by: number,
      opposite: boolean,
      vertical: boolean,
    ): boolean => {
      if (vertical) {
        const opp = clamp(opposite ? bx + sizeX : bx - 1, -1, room.width);
        if (opp === -1 || opp === room.width) {
          for (let i = 0; i < sizeY + 1; i++) {
            for (let d = -1; d <= 1; d += 2) {
              const y = by + sizeCY + i * d;
              if (y >= 0 && y < room.height) {
                let place = true;
                const ry = y + room.y;
                const link = room.links.find(
                  (lnk) =>
                    lnk.vertical &&
                    lnk.x === opp + room.x &&
                    lnk.y <= ry &&
                    lnk.y + lnk.length > ry,
                );
                if (link) {
                  if (link.tiles[ry - link.y] !== GeneratorTileType.Wall) {
                    place = false;
                  }
                }

                if (place) {
                  walls[y + 1][opp + 1] = {
                    type: WallHintType.Torch,
                  };

                  return true;
                }
              }
            }
          }
        }
      } else {
        const opp = clamp(opposite ? by + sizeY : by - 1, -1, room.height);
        if (opp === -1 || opp === room.height) {
          for (let i = 0; i < sizeX + 1; i++) {
            for (let d = -1; d <= 1; d += 2) {
              const x = bx + sizeCX + i * d;
              if (x >= 0 && x < room.width) {
                let place = true;
                const rx = x + room.x;
                const link = room.links.find(
                  (lnk) =>
                    !lnk.vertical &&
                    lnk.y === opp + room.y &&
                    lnk.x <= rx &&
                    lnk.x + lnk.length > rx,
                );
                if (link) {
                  if (link.tiles[rx - link.x] !== GeneratorTileType.Wall) {
                    place = false;
                  }
                }

                if (place) {
                  walls[opp + 1][x + 1] = {
                    type: WallHintType.Torch,
                  };

                  return true;
                }
              }
            }
          }
        }
      }

      return false;
    };

    // Tasks for torch check
    const tasks: [boolean, boolean][] = [
      [false, false],
      [false, true],
      [true, false],
      [true, true],
    ];
    if (room.height > room.width || (room.width === room.height && this.random() < 0.5)) {
      // Flip indices for opposite wall first
      [tasks[0], tasks[1]] = [tasks[1], tasks[0]];
      [tasks[2], tasks[3]] = [tasks[3], tasks[2]];
    }

    for (let by = 0; by < blocksY; by++) {
      for (let bx = 0; bx < blocksX; bx++) {
        const startX = bx * sizeX;
        const startY = by * sizeY;

        let placed = false;
        for (const [side, vertical] of tasks) {
          if (placeWallTorch(startX, startY, side, vertical)) {
            placed = true;
            break;
          }
        }
        if (!placed) {
          // Place floor torch
          floor[startY + sizeCY][startX + sizeCX] = {
            type: FloorHintType.Fireplace,
          };
        }
      }
    }
  }

  public makeLibrary(
    room: GeneratorRoom,
    floor: FloorHint[][],
    walls: WallHint[][],
    scenery: SceneryTileHint[],
  ) {
    for (let i = 0; i < walls[0].length; i++) {
      walls[0][i] = {
        type: WallHintType.AccentWall,
      };
    }
    for (let i = 0; i < walls.length; i++) {
      walls[i][0] = {
        type: WallHintType.AccentWall,
      };
    }

    // floor[1][1] = {
    //   type: FloorHintType.SceneryTile,
    //   tiles: [
    //     {
    //       name: 'jug',
    //       group: 0,
    //       variant: 0,
    //       angle: 0,
    //       height: 1.565 / 3,
    //       scale: 1,
    //     },
    //   ],
    // };
  }
}
