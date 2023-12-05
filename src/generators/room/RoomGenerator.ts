import { GeneratorLink, GeneratorRoom, GeneratorTileType } from '../dungeon/DungeonGenerator.ts';
import { MeshOutlinePart } from '../trimesh/RoomTriangulator.ts';

export type DecoratedTile = {
  x: number;
  y: number;
  height?: number;
  angle?: number;

  name: string;
  group: number;
  variant: number;
};

interface TileContainer {
  tiles: DecoratedTile[];
  outlines?: MeshOutlinePart[];
}

export interface DecoratedRoom extends TileContainer {
  generatorRoom: GeneratorRoom;
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
