import { StaticObject } from '@/entities/objects/StaticObject.ts';
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

export interface TriangulatedSurface {
  vertexData: number[];
  tangentData?: number[];
  indexData: number[];
  indexCount: number;
}

export interface TriangulatedSurfaceGroup {
  floor: TriangulatedSurface;
  walls: TriangulatedSurface[];
  wallOutline?: TriangulatedSurface[];
}

export interface TriangulatedRoom extends TriangulatedSurfaceGroup {
  decoratedRoom: DecoratedRoom;
  lights: LightDef[];
  scenery: StaticObject[];
}

export interface TriangulatedLink extends TriangulatedSurfaceGroup {
  decoratedLink: DecoratedLink;
}

export interface TriangulatedOutlinePart {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export abstract class RoomTriangulator {
  protected baseRooms: DecoratedRoom[];

  protected baseLinks: DecoratedLink[];

  protected rooms: TriangulatedRoom[];

  protected links: TriangulatedLink[];

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
