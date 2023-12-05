import { DecoratedLink, DecoratedRoom } from '../room/RoomGenerator.ts';

export enum LightDefType {
  WallTorch,
  Fireplace,
}

export interface LightDef {
  x: number;
  y: number;
  height: number;
  type: LightDefType;
}

export interface MeshSurface {
  vertexData: number[];
  tangentData?: number[];
  indexData: number[];
  indexCount: number;
}

export interface MeshRoom extends MeshSurface {
  decoratedRoom: DecoratedRoom;
  lights: LightDef[];
  outline?: MeshSurface;
}

export interface MeshLink extends MeshSurface {
  decoratedLink: DecoratedLink;
  outline?: MeshSurface;
}

export interface MeshOutlinePart {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export abstract class RoomTriangulator {
  protected baseRooms: DecoratedRoom[];

  protected baseLinks: DecoratedLink[];

  protected rooms: MeshRoom[];

  protected links: MeshLink[];

  protected constructor(rooms: DecoratedRoom[], links: DecoratedLink[]) {
    this.baseRooms = rooms;
    this.baseLinks = links;
    this.rooms = [];
    this.links = [];
  }

  public abstract triangulate(): void;

  public getRooms() {
    return this.rooms;
  }

  public getLinks() {
    return this.links;
  }
}
