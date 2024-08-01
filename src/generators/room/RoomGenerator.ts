import { GeneratorLink, GeneratorRoom, GeneratorTileType } from '../dungeon/DungeonGenerator.ts';

export type DecoratedTile = {
  x: number;
  y: number;
  height?: number;
  angle?: number;
  scale?: number;

  name: string;
  group: number;
  variant: number;
  scenery?: boolean;
};

interface TileContainer {
  tiles: DecoratedTile[];
}

export interface DecoratedRoom extends TileContainer {
  generatorRoom: GeneratorRoom;
  sceneryTiles: DecoratedTile[];
}

export interface DecoratedLink extends TileContainer {
  generatorLink: GeneratorLink;
}

export abstract class RoomGenerator {
  protected readonly rooms: DecoratedRoom[] = [];

  protected readonly links: DecoratedLink[] = [];

  protected readonly baseRooms: GeneratorRoom[];

  protected readonly baseLinks: GeneratorLink[];

  protected map: GeneratorTileType[][];

  protected constructor(
    protected readonly seed: string,
    map: GeneratorTileType[][],
    rooms: GeneratorRoom[],
    links: GeneratorLink[],
  ) {
    this.baseRooms = rooms;
    this.baseLinks = links;
    this.map = map;
  }

  public abstract generate(): void;

  public getRooms() {
    return this.rooms;
  }

  public getLinks() {
    return this.links;
  }
}
