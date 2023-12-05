export interface GeneratorRoom {
  x: number;
  y: number;
  width: number;
  height: number;

  links: GeneratorLink[];
}

export interface GeneratorLink {
  room1: GeneratorRoom;
  room2: GeneratorRoom;
  transparent: boolean;

  x: number;
  y: number;
  vertical: boolean;
  length: number;
  tiles: GeneratorTileType[];
}

export enum GeneratorTileType {
  None,
  Wall,
  Fence,
  Door,
  FenceDoor,
}

export abstract class DungeonGenerator {
  protected readonly rooms: GeneratorRoom[];

  protected readonly links: GeneratorLink[];

  protected map: GeneratorTileType[][];

  protected startRoom: GeneratorRoom | null;

  protected endRoom: GeneratorRoom | null;

  protected constructor(
    protected readonly seed: string,
    protected readonly width: number,
    protected readonly height: number,
  ) {
    this.rooms = [];
    this.links = [];
    this.map = Array(height)
      .fill(0)
      .map(() => Array(width).fill(GeneratorTileType.Wall));
    this.startRoom = null;
    this.endRoom = null;
  }

  public abstract generate(): void;

  public getSize(): readonly [number, number] {
    return [this.width, this.height] as const;
  }

  public getRooms(): GeneratorRoom[] {
    return this.rooms;
  }

  public getLinks(): GeneratorLink[] {
    return this.links;
  }

  public getBlockMap() {
    return this.map;
  }

  public getMainRooms(): readonly [GeneratorRoom, GeneratorRoom] {
    return [this.startRoom ?? this.rooms[0], this.endRoom ?? this.rooms[1]] as const;
  }
}
