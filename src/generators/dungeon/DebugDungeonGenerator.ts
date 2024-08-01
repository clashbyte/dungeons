import {
  DungeonGenerator,
  GeneratorLink,
  GeneratorRoom,
  GeneratorTileType,
} from './DungeonGenerator.ts';

export class DebugDungeonGenerator extends DungeonGenerator {
  public constructor(seed: string, width: number, height: number) {
    super(seed, width, height);
  }

  public generate(): void {
    const ROOM_WIDTH = 4;
    const ROOM_HEIGHT = 4;

    const r1: GeneratorRoom = {
      x: 2,
      y: 2,
      width: ROOM_WIDTH,
      height: ROOM_HEIGHT,
      links: [],
    };
    const r2: GeneratorRoom = {
      x: 2,
      y: 2 + ROOM_HEIGHT + 1,
      width: 4,
      height: 4,
      links: [],
    };

    this.rooms.push(r1, r2);
    this.startRoom = r1;
    this.endRoom = r2;

    const l: GeneratorLink = {
      x: 2,
      y: ROOM_HEIGHT + 2,
      length: 4,
      room1: r1,
      room2: r2,
      transparent: false,
      vertical: false,
      tiles: [
        GeneratorTileType.Wall,
        GeneratorTileType.Wall,
        GeneratorTileType.Door,
        GeneratorTileType.Wall,
      ],
    };
    r1.links.push(l);
    r2.links.push(l);
    this.links.push(l);

    this.flattenRooms();

    // this.links.push(l);
  }

  private flattenRooms() {
    for (const r of this.rooms) {
      for (let y = 0; y < r.height; y++) {
        for (let x = 0; x < r.width; x++) {
          this.map[y + r.y][x + r.x] = GeneratorTileType.None;
        }
      }
    }
    for (const l of this.links) {
      for (let p = 0; p < l.length; p++) {
        this.map[l.y + (l.vertical ? p : 0)][l.x + (!l.vertical ? p : 0)] = l.tiles[p];
      }
    }
  }
}
