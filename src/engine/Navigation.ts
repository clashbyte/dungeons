import { vec2 } from 'gl-matrix';
import { Door } from '../entities/objects/Door.ts';
import { LevelObject } from '../entities/objects/LevelObject.ts';
import {
  GeneratorLink,
  GeneratorRoom,
  GeneratorTileType,
} from '../generators/dungeon/DungeonGenerator.ts';
import { clamp, saturate } from '../helpers/MathUtils.ts';
import { VisibilityManager } from '../managers/VisibilityManager.ts';

type Entity = GeneratorRoom | GeneratorLink;
type SearchResult =
  | { entity: GeneratorRoom; point: vec2; link?: false }
  | { entity: GeneratorLink; point: vec2; link: true };

interface PathNode {
  position: vec2;
  radius: number;
}

/**
 * Class for player navigation
 */
export class Navigation {
  /**
   * Active level doors
   * @private
   */
  private doors: Door[] = [];

  /**
   * Create navigation class
   * @param rooms
   * @param links
   */
  public constructor(
    private readonly rooms: GeneratorRoom[],
    private readonly links: GeneratorLink[],
  ) {}

  /**
   * Update doors list
   * @param doors
   */
  public setDoors(doors: Door[]) {
    this.doors = doors;
  }

  /**
   * Build path from one point to another
   * @param from
   * @param to
   * @param toRadius
   * @param targetObject
   */
  public buildPath(
    from: vec2,
    to: vec2,
    toRadius: number = 0,
    targetObject: LevelObject | null = null,
  ): PathNode[] | null {
    const nodes: PathNode[] = [];
    const start = this.findRoomOrLink(from);
    const target = this.findRoomOrLink(to);
    if (start && target) {
      // Same room/link navigation
      if (start.entity === target.entity) {
        nodes.push({
          position: target.point,
          radius: toRadius,
        });

        return nodes;
      }

      // Build nav path
      const paths = this.findPaths(start, target, targetObject);
      if (paths.length) {
        let path = paths[0];
        for (let i = 0; i < paths.length; i++) {
          if (path.length > paths[i].length) {
            path = paths[i];
          }
        }

        // Build path points
        let p = 0;
        if (!('links' in path[0])) {
          p++;
        }
        for (let i = p; i < path.length; i += 2) {
          if (!('links' in path[i])) {
            return null;
          }

          const room = path[i] as GeneratorRoom;
          let prevLink: GeneratorLink | null = null;
          let nextLink: GeneratorLink | null = null;
          let nextNextLink: GeneratorLink | null = null;
          if (i > 0) {
            prevLink = path[i - 1] as GeneratorLink;
          }
          if (i < path.length - 1) {
            nextLink = path[i + 1] as GeneratorLink;
          }
          if (i < path.length - 3) {
            nextNextLink = path[i + 3] as GeneratorLink;
          }

          if (prevLink && !prevLink.transparent) {
            const point = this.findLinkPoint(room, prevLink);
            if (point) {
              nodes.push({
                position: point,
                radius: 0,
              });
            }
          }
          if (nextLink) {
            const ahead = vec2.clone(to);
            if (nextNextLink) {
              const nextRoom = nextLink.room1 === room ? nextLink.room2 : nextLink.room1;
              const nextNext = this.findLinkPoint(
                nextRoom,
                nextNextLink,
                null,
                nodes.length > 0 ? nodes[nodes.length - 1].position : from,
              );
              if (nextNext) {
                vec2.copy(ahead, nextNext);
              }
            }

            const point = this.findLinkPoint(
              room,
              nextLink,
              ahead,
              nodes.length > 0 ? nodes[nodes.length - 1].position : from,
            );
            if (point) {
              nodes.push({
                position: point,
                radius: 0,
              });
            }
          }
        }

        nodes.push({
          position: target.point,
          radius: toRadius,
        });

        return nodes;
      }
    }

    return null;
  }

  /**
   * Find all available paths from room to room
   * @param from
   * @param to
   * @param targetObject
   * @private
   */
  private findPaths(
    from: SearchResult,
    to: SearchResult,
    targetObject: LevelObject | null,
  ): Entity[][] {
    const paths: Entity[][] = [];

    const traverseNode = (node: Entity, stack: Entity[]) => {
      const newStack = [...stack, node];
      if (node === to.entity) {
        paths.push(newStack);

        return;
      }

      if ('links' in node) {
        for (const link of node.links) {
          if (!stack.includes(link)) {
            if (!this.linkBlocked(link, targetObject)) {
              traverseNode(link, newStack);
            }
          }
        }
      } else {
        for (const target of [node.room1, node.room2]) {
          if (!stack.includes(target)) {
            traverseNode(target, newStack);
          }
        }
      }
    };
    traverseNode(from.entity, []);

    return paths;
  }

  /**
   * Pick room or link by direct coords
   * @param point
   * @private
   */
  private findRoomOrLink(point: vec2): SearchResult | null {
    const ROOM_GAP = 0.48;
    let x = point[0];
    let y = point[1];

    for (let i = 0; i < this.rooms.length; i++) {
      const room = this.rooms[i];
      if (
        VisibilityManager.roomState(i) > 0 &&
        room.x <= x + ROOM_GAP &&
        room.y <= y + ROOM_GAP &&
        room.x + room.width >= x - ROOM_GAP &&
        room.y + room.height >= y - ROOM_GAP
      ) {
        x = clamp(x, room.x + 0.01, room.x + room.width - 0.01);
        y = clamp(y, room.y + 0.01, room.y + room.height - 0.01);

        return {
          entity: room,
          point: vec2.fromValues(x, y),
        };
      }
    }

    // Room not found - search for link
    const fx = Math.floor(x);
    const fy = Math.floor(y);
    for (let i = 0; i < this.links.length; i++) {
      const link = this.links[i];
      if (
        VisibilityManager.linkState(i) > 0 &&
        link.x <= fx &&
        link.y <= fy &&
        link.x + (!link.vertical ? link.length : 1) > fx &&
        link.y + (link.vertical ? link.length : 1) > fy
      ) {
        const tile = link.tiles[link.vertical ? fy - link.y : fx - link.x];
        if (tile !== GeneratorTileType.Wall && tile !== GeneratorTileType.Fence) {
          return {
            entity: link,
            link: true,
            point: vec2.fromValues(x, y),
          };
        }
      }
    }

    return null;
  }

  /**
   * Get link's target position
   * @param room
   * @param link
   * @param nextPos
   * @param prevPos
   * @private
   */
  private findLinkPoint(
    room: GeneratorRoom,
    link: GeneratorLink,
    nextPos: vec2 | null = null,
    prevPos: vec2 | null = null,
  ): vec2 | null {
    let byDoor = false;
    let start = 0;
    const end = link.length;
    if (link.transparent) {
      // Search for door in fence link
      for (let i = 0; i < link.length; i++) {
        if (
          link.tiles[i] === GeneratorTileType.FenceDoor ||
          link.tiles[i] === GeneratorTileType.Door
        ) {
          byDoor = true;
          start = i;
          break;
        }
      }

      // TODO: find fence and clamp walkway
    } else {
      // Link is a wall with door
      byDoor = true;
      for (let i = 0; i < link.length; i++) {
        if (link.tiles[i] === GeneratorTileType.Door) {
          start = i;
          break;
        }
      }
    }

    // Offset direction
    let dirX = 0;
    let dirY = 0;
    if (link.vertical) {
      dirX = link.x === room.x + room.width ? -1 : 1;
    } else {
      dirY = link.y === room.y + room.height ? -1 : 1;
    }

    // Direct door navigation
    if (byDoor) {
      return vec2.fromValues(
        link.x + 0.5 + (!link.vertical ? start : 0) + dirX * 0.5,
        link.y + 0.5 + (link.vertical ? start : 0) + dirY * 0.5,
      );
    }

    // Check for gap intersection
    if (prevPos && nextPos) {
      const otherRoom = link.room1 === room ? link.room2 : link.room1;
      const dir = vec2.fromValues(!link.vertical ? 1 : 0, link.vertical ? 1 : 0);
      const off = vec2.fromValues(link.x + dir[1] * 0.5, link.y + dir[0] * 0.5);
      const ls = vec2.clone(off);
      const le = vec2.clone(off);
      vec2.scaleAndAdd(ls, ls, dir, start + 0.1);
      vec2.scaleAndAdd(le, le, dir, end - 0.1);

      const intersect = this.linesIntersect(ls, le, prevPos, nextPos);
      if (intersect) {
        const delta = intersect.seg1;
        const pos = vec2.lerp(vec2.create(), ls, le, saturate(delta));
        let factor = 0;
        if (delta < 0) {
          if (link.vertical) {
            if (link.y > otherRoom.y) {
              factor = -1;
            } else {
              factor = 1;
            }
          } else if (link.x > otherRoom.x) {
            factor = -1;
          } else {
            factor = 1;
          }
        } else if (delta > 1) {
          if (link.vertical) {
            if (link.y + link.length < otherRoom.y + otherRoom.height) {
              factor = -1;
            } else {
              factor = 1;
            }
          } else if (link.x + link.length < otherRoom.x + otherRoom.width) {
            factor = -1;
          } else {
            factor = 1;
          }
        }
        vec2.add(pos, pos, vec2.fromValues(dirX * 0.5 * factor, dirY * 0.5 * factor));

        return pos;
      }
    }

    return null;
  }

  /**
   * Check if link is blocked
   * @param link
   * @param targetObject
   * @private
   */
  private linkBlocked(link: GeneratorLink, targetObject: LevelObject | null = null) {
    for (let i = 0; i < link.length; i++) {
      const t = link.tiles[i];
      if (t === GeneratorTileType.None) {
        return false;
      }
      if (t === GeneratorTileType.Door || t === GeneratorTileType.FenceDoor) {
        const dx = link.x + (!link.vertical ? i : 0);
        const dy = link.y + (link.vertical ? i : 0);
        for (const door of this.doors) {
          if (door.x === dx && door.y === dy) {
            if (door.isOpen || targetObject === door) {
              return false;
            }
          }
        }
      }
    }

    return true;
  }

  /**
   * Check for two lines intersection
   * @param start1
   * @param end1
   * @param start2
   * @param end2
   * @private
   */
  private linesIntersect(start1: vec2, end1: vec2, start2: vec2, end2: vec2) {
    const denom =
      (end2[1] - start2[1]) * (end1[0] - start1[0]) - (end2[0] - start2[0]) * (end1[1] - start1[1]);
    if (denom === 0) {
      return null;
    }
    const ua =
      ((end2[0] - start2[0]) * (start1[1] - start2[1]) -
        (end2[1] - start2[1]) * (start1[0] - start2[0])) /
      denom;
    const ub =
      ((end1[0] - start1[0]) * (start1[1] - start2[1]) -
        (end1[1] - start1[1]) * (start1[0] - start2[0])) /
      denom;

    return {
      x: start1[0] + ua * (end1[0] - start1[0]),
      y: start1[1] + ua * (end1[1] - start1[1]),
      seg1: ua,
      seg2: ub,
    };
  }
}
