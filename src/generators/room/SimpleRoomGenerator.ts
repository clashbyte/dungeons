import Alea from 'alea';
import {
  FloorHint,
  FloorHintType,
  LevelType,
  SimpleRoomDecorator,
  WallHint,
  WallHintType,
} from '@/generators/decoration/SimpleRoomDecorator.ts';
import {
  GeneratorLink,
  GeneratorRoom,
  GeneratorTileType,
} from '@/generators/dungeon/DungeonGenerator.ts';
import {
  DecoratedLink,
  DecoratedRoom,
  DecoratedTile,
  RoomGenerator,
} from '@/generators/room/RoomGenerator.ts';

enum FloorType {
  Normal,
  LooseTile,
  Crack,
}

export enum WallType {
  Normal,
  NormalWithHole,
  Torch,
  NormalAccent,
  RoundInsideCorner,
  ThinJoin,
  RoundOutsideCorner,
  Door,
  DoorBlocked,
  OutsideCorner,
  InsideCorner,
}

export class SimpleRoomGenerator extends RoomGenerator {
  private readonly random: () => number;

  private readonly theme: number;

  private readonly decorator: SimpleRoomDecorator;

  public constructor(
    seed: string,
    theme: LevelType,
    map: GeneratorTileType[][],
    rooms: GeneratorRoom[],
    links: GeneratorLink[],
  ) {
    super(seed, map, rooms, links);
    this.theme = theme;
    this.decorator = new SimpleRoomDecorator(seed, theme);

    const alea = Alea(`${seed}_tile`);
    this.random = () => alea.next();

    console.debug(seed);
  }

  public generate(): void {
    this.rooms.length = 0;
    this.links.length = 0;
    for (const room of this.baseRooms) {
      this.rooms.push(this.buildRoom(room));
    }
    for (const link of this.baseLinks) {
      this.links.push(this.buildLink(link));
    }
  }

  private buildRoom(room: GeneratorRoom): DecoratedRoom {
    const tiles: DecoratedTile[] = [];
    const scenery: DecoratedTile[] = [];
    const [floorHints, wallHints, sceneryTiles, roundCorners] = this.decorator.makeHintMap(room);
    for (let y = 0; y < room.height; y++) {
      for (let x = 0; x < room.width; x++) {
        const cellTiles = this.wrapTile(x, y, room.x, room.y, floorHints, wallHints, roundCorners);
        if (cellTiles.length > 0) {
          tiles.push(...cellTiles);
        }
      }
    }

    for (const hint of sceneryTiles) {
      scenery.push(hint);
    }

    return {
      generatorRoom: room,
      sceneryTiles: scenery,
      tiles,
    };
  }

  private buildLink(link: GeneratorLink): DecoratedLink {
    const tiles: DecoratedTile[] = [];
    const solid = [
      GeneratorTileType.Wall,
      GeneratorTileType.Door,
      GeneratorTileType.Fence,
      GeneratorTileType.FenceDoor,
    ];

    for (let i = 0; i < link.length; i++) {
      const x = !link.vertical ? i : 0;
      const y = link.vertical ? i : 0;
      const tile = link.tiles[i];
      if (tile === GeneratorTileType.Door || tile === GeneratorTileType.FenceDoor) {
        const orient = link.vertical ? 1 : 0;
        tiles.push({
          x,
          y,
          name: 'wall',
          group: this.theme,
          variant: WallType.Door,
          angle: orient,
        });
      } else if (tile === GeneratorTileType.None) {
        if (i === 0 || i === link.length - 1) {
          const opp = i === 0 ? -1 : 1;
          const px = x + link.x;
          const py = y + link.y;

          const left = solid.includes(
            this.map[py + (!link.vertical ? 1 : opp)][px + (link.vertical ? -1 : opp)],
          );
          const right = solid.includes(
            this.map[py + (!link.vertical ? -1 : opp)][px + (link.vertical ? 1 : opp)],
          );
          if (left && right) {
            tiles.push({
              x: x + (!link.vertical ? opp : 0),
              y: y + (link.vertical ? opp : 0),
              name: 'wall',
              group: this.theme,
              angle: ((link.vertical ? 0 : 3) + (i === 0 ? 0 : 2)) % 4,
              variant: WallType.Normal,
            });
          }
        }
        tiles.push({
          x,
          y,
          name: 'floor',
          group: this.theme,
          variant: 0,
        });
      }
    }

    return {
      generatorLink: link,
      tiles,
    };
  }

  private wrapTile(
    x: number,
    y: number,
    roomX: number,
    roomY: number,
    floorHints: FloorHint[][],
    wallHints: WallHint[][],
    roundCorners: boolean,
  ): DecoratedTile[] {
    const tiles: DecoratedTile[] = [];
    const rx = x + roomX;
    const ry = y + roomY;
    const solid = [
      GeneratorTileType.Wall,
      GeneratorTileType.Door,
      GeneratorTileType.Fence,
      GeneratorTileType.FenceDoor,
    ];
    const doors = [GeneratorTileType.Door, GeneratorTileType.FenceDoor];

    const tile = this.map[ry][rx];

    const up = solid.includes(this.map[ry - 1][rx]);
    const down = solid.includes(this.map[ry + 1][rx]);
    const left = solid.includes(this.map[ry][rx - 1]);
    const right = solid.includes(this.map[ry][rx + 1]);
    const upLeft = solid.includes(this.map[ry - 1][rx - 1]);
    const upRight = solid.includes(this.map[ry - 1][rx + 1]);
    const downLeft = solid.includes(this.map[ry + 1][rx - 1]);
    const downRight = solid.includes(this.map[ry + 1][rx + 1]);

    const farUp = ry - 2 < 0 ? true : solid.includes(this.map[ry - 2][rx]);
    // const farLeft = rx - 2 < 0 ? true : solid.includes(this.map[ry][rx - 2]);
    const farDown = ry + 2 >= this.map.length ? true : solid.includes(this.map[ry + 2][rx]);
    // const farRight = rx + 2 >= this.map[0].length ? true : solid.includes(this.map[ry][rx + 2]);

    const upDoor = doors.includes(this.map[ry - 1][rx]);
    const downDoor = doors.includes(this.map[ry + 1][rx]);
    const leftDoor = doors.includes(this.map[ry][rx - 1]);
    const rightDoor = doors.includes(this.map[ry][rx + 1]);

    const hintUp = wallHints[y][x + 1]!;
    const hintDown = wallHints[y + 2][x + 1]!;
    const hintLeft = wallHints[y + 1][x]!;
    const hintRight = wallHints[y + 1][x + 2]!;
    const hint = floorHints[y][x]!;

    if (tile === GeneratorTileType.None) {
      let floorVariant = FloorType.Normal;
      if (!upDoor && !downDoor && !leftDoor && !rightDoor) {
        switch (hint.type) {
          case FloorHintType.LooseTile:
            floorVariant = FloorType.LooseTile;
            break;
          case FloorHintType.Cracked:
            floorVariant = FloorType.Crack;
            break;
          case FloorHintType.Fireplace:
            tiles.push({
              x,
              y,
              name: 'fireplace',
              group: 0,
              variant: 0,
              angle: 0,
            });
            // tiles.push({
            //   x,
            //   y,
            //   name: 'collumn',
            //   group: 0,
            //   variant: 0,
            //   angle: 0,
            // });
            break;
          // case FloorHintType.SceneryTile:
          //   tiles.push(
          //     ...hint.tiles.map((h) => ({
          //       x: x + (h.x ?? 0),
          //       y: y + (h.y ?? 0),
          //       name: h.name,
          //       height: h.height,
          //       scale: h.scale ?? 1,
          //       group: h.group,
          //       variant: h.variant,
          //       angle: h.angle,
          //       scenery: true,
          //     })),
          //   );
          //   break;
        }
      }

      if (hint.type !== FloorHintType.SkipMesh) {
        tiles.push({
          x,
          y,
          name: 'floor',
          group: this.theme,
          variant: floorVariant,
          angle: Math.floor(this.random() * 4),
        });
      }

      if (up && !upDoor) {
        let angle: 0 | 1 | 2 | 3 = 0;
        let variant = WallType.Normal;
        if (!upLeft) {
          if (!farUp) {
            variant = WallType.ThinJoin;
            angle = 1;
          } else {
            variant = WallType.OutsideCorner;
            angle = 1;
          }
        } else if (!upRight) {
          if (!farUp) {
            variant = WallType.ThinJoin;
            angle = 3;
          } else {
            variant = WallType.OutsideCorner;
            angle = 0;
          }
        }

        if (variant === WallType.Normal && hintUp.type !== WallHintType.None) {
          switch (hintUp.type) {
            case WallHintType.AccentWall:
              variant = WallType.NormalAccent;
              break;
            case WallHintType.Window:
              variant = WallType.NormalWithHole;
              break;

            case WallHintType.Torch:
              variant = WallType.Torch;
              break;
          }
        }

        tiles.push({
          x,
          y: y - 1,
          angle,
          name: 'wall',
          group: this.theme,
          variant,
        });
      }

      if (down && !downDoor) {
        let angle: 0 | 1 | 2 | 3 = 2;
        let variant = WallType.Normal;
        if (!downRight) {
          variant = WallType.OutsideCorner;
          angle = 3;
        } else if (!downLeft) {
          if (!farDown) {
            variant = WallType.ThinJoin;
            angle = 1;
          } else {
            variant = WallType.OutsideCorner;
            angle = 2;
          }
        }

        if (variant === WallType.Normal && hintDown.type !== WallHintType.None) {
          switch (hintDown.type) {
            case WallHintType.AccentWall:
              variant = WallType.NormalAccent;
              break;
            case WallHintType.Window:
              variant = WallType.NormalWithHole;
              break;

            case WallHintType.Torch:
              variant = WallType.Torch;
              break;
          }
        }

        tiles.push({
          x,
          y: y + 1,
          angle,
          name: 'wall',
          group: this.theme,
          variant,
        });
      }

      if (left && !leftDoor) {
        let angle: 0 | 1 | 2 | 3 = 3;
        let variant = WallType.Normal;
        if (!downLeft) {
          variant = WallType.OutsideCorner;
          angle = 0;
        } else if (!upLeft) {
          variant = WallType.OutsideCorner;
          angle = 3;
        }

        if (variant === WallType.Normal && hintLeft.type !== WallHintType.None) {
          switch (hintLeft.type) {
            case WallHintType.AccentWall:
              variant = WallType.NormalAccent;
              break;
            case WallHintType.Window:
              variant = WallType.NormalWithHole;
              break;

            case WallHintType.Torch:
              variant = WallType.Torch;
              break;
          }
        }

        tiles.push({
          x: x - 1,
          y,
          angle,
          name: 'wall',
          group: this.theme,
          variant,
        });
      }

      if (right && !rightDoor) {
        let angle: 0 | 1 | 2 | 3 = 1;
        let variant = WallType.Normal;
        if (!upRight) {
          variant = WallType.OutsideCorner;
          angle = 2;
        } else if (!downRight) {
          variant = WallType.OutsideCorner;
          angle = 1;
        }

        if (variant === WallType.Normal && hintRight.type !== WallHintType.None) {
          switch (hintRight.type) {
            case WallHintType.AccentWall:
              variant = WallType.NormalAccent;
              break;
            case WallHintType.Window:
              variant = WallType.NormalWithHole;
              break;

            case WallHintType.Torch:
              variant = WallType.Torch;
              break;
          }
        }

        tiles.push({
          x: x + 1,
          y,
          angle,
          name: 'wall',
          group: this.theme,
          variant,
        });
      }

      // Create corners
      if (up && left) {
        tiles.push({
          x: x - 1,
          y: y - 1,
          angle: 0,
          name: 'wall',
          group: this.theme,
          variant: roundCorners ? WallType.RoundInsideCorner : WallType.InsideCorner,
        });
      }

      if (up && right) {
        tiles.push({
          x: x + 1,
          y: y - 1,
          angle: 1,
          name: 'wall',
          group: this.theme,
          variant: roundCorners ? WallType.RoundInsideCorner : WallType.InsideCorner,
        });
      }

      if (down && right) {
        tiles.push({
          x: x + 1,
          y: y + 1,
          angle: 2,
          name: 'wall',
          group: this.theme,
          variant: roundCorners ? WallType.RoundInsideCorner : WallType.InsideCorner,
        });
      }

      if (down && left) {
        tiles.push({
          x: x - 1,
          y: y + 1,
          angle: 3,
          name: 'wall',
          group: this.theme,
          variant: roundCorners ? WallType.RoundInsideCorner : WallType.InsideCorner,
        });
      }
    }

    return tiles;
  }
}
