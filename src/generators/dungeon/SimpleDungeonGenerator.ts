import Alea from 'alea';
import {
  DungeonGenerator,
  GeneratorLink,
  GeneratorRoom,
  GeneratorTileType,
} from './DungeonGenerator.ts';

enum Direction {
  Up,
  Right,
  Down,
  Left,
}

interface LinkedGeneratorRoom extends GeneratorRoom {
  parent: LinkedGeneratorRoom | null;
  children: LinkedGeneratorRoom[];
}

interface RoomTask {
  room: LinkedGeneratorRoom;
  direction: Direction;
}

interface RoomIntersection {
  x: number;
  y: number;
  length: number;
  vertical: boolean;
}

type ConnectTask = readonly [number, number, boolean];

export class SimpleDungeonGenerator extends DungeonGenerator {
  private readonly random: () => number;

  private readonly randomInt: (max?: number) => number;

  protected readonly rooms: LinkedGeneratorRoom[];

  public constructor(seed: string, width: number, height: number) {
    super(seed, width, height);
    this.rooms = [];

    const alea = Alea(seed);
    this.random = alea.next;
    this.randomInt = (max?: number) => {
      let val = alea.uint32();
      if (max !== undefined) {
        val %= max + 1;
      }

      return val;
    };
  }

  public generate(): void {
    let totalAttempts = 0;
    do {
      this.rooms.length = 0;

      totalAttempts++;
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          this.map[y][x] = GeneratorTileType.Wall;
        }
      }

      // Generate room map
      const baseRoom = this.generateRoom();
      baseRoom.x = this.randomRange(1, this.width - baseRoom.width - 2);
      baseRoom.y = this.randomRange(1, this.height - baseRoom.height - 2);
      this.rooms.push(baseRoom);
      const tasks: RoomTask[] = Array(4)
        .fill(0)
        .map((_, idx) => ({ room: baseRoom, direction: idx }));
      while (tasks.length > 0) {
        const task = tasks.shift()!;
        const nextTasks = this.placeRoomBranch(task);
        if (nextTasks.length > 0) {
          tasks.push(...nextTasks);
        }
      }
      this.flattenRooms();

      // Create room connections
      this.linkRooms();

      // Add random connections and link rooms together
    } while (!this.validateMap());

    this.assignMainRooms();
  }

  private placeRoomBranch(task: RoomTask) {
    const { room: base, direction } = task;
    const quota = 3;
    for (let attempt = 0; attempt < 24; attempt++) {
      const room = this.generateRoom(Math.floor(attempt / 6));
      const shift = 1; // this.random() < 0.7 ? 1 : 0;
      if (direction === Direction.Up || direction === Direction.Down) {
        const x = this.randomRange(base.x - room.width + quota, base.x + base.width - quota);
        let y = base.y + base.height + shift;
        if (direction === Direction.Up) {
          y = base.y - room.height - shift;
        }
        room.x = x;
        room.y = y;
      } else {
        const y = this.randomRange(base.y - room.height + quota, base.y + base.height - quota);
        let x = base.x + base.width + shift;
        if (direction === Direction.Left) {
          x = base.x - room.width - shift;
        }
        room.x = x;
        room.y = y;
      }

      if (room.x <= 1) {
        room.x = 1;
      }
      if (room.y <= 1) {
        room.y = 1;
      }
      if (room.x + room.width >= this.width - 1) {
        room.x = this.width - room.width - 1;
      }
      if (room.y + room.height >= this.height - 1) {
        room.y = this.height - room.height - 1;
      }

      if (this.canPlaceRoom(room)) {
        this.rooms.push(room);
        room.parent = base;
        base.children.push(room);

        const nextTasks: RoomTask[] = [];

        for (let i = 0; i < 4; i++) {
          nextTasks.push({
            room,
            direction: i,
          });
        }

        return nextTasks;
      }
    }

    return [];
  }

  private randomRange(from: number, to: number) {
    if (from === to || to < from) {
      return from;
    }

    return from + this.randomInt(to - from);
  }

  private generateRoom(decrease: number = 0): LinkedGeneratorRoom {
    let w = this.randomRange(5 - Math.floor(decrease / 3), 10 - decrease * 3);
    let h = this.randomRange(5 - Math.floor(decrease / 3), 10 - decrease * 3);
    if (w % 2 === 0) {
      w--;
    }
    if (h % 2 === 0) {
      h--;
    }

    return {
      x: 1,
      y: 1,
      width: w,
      height: h,
      parent: null,
      children: [],
      links: [],
    };
  }

  private flattenRooms() {
    for (const r of this.rooms) {
      for (let y = 0; y < r.height; y++) {
        for (let x = 0; x < r.width; x++) {
          this.map[y + r.y][x + r.x] = GeneratorTileType.None;
        }
      }
    }
  }

  private createLinkTasks() {
    const links: ConnectTask[] = [];

    for (const room of this.rooms) {
      for (const other of room.children) {
        const idx1 = this.getRoomIndex(room);
        const idx2 = this.getRoomIndex(other);
        if (
          links.findIndex(
            (c) => (c[0] === idx1 && c[1] === idx2) || (c[0] === idx2 && c[1] === idx1),
          ) === -1
        ) {
          links.push([idx1, idx2, false]);
        }
      }
    }

    for (const room of this.rooms) {
      for (const other of this.rooms) {
        if (other !== room) {
          const overlap = this.getRoomIntersection(room, other);
          if (overlap) {
            const idx1 = this.getRoomIndex(room);
            const idx2 = this.getRoomIndex(other);
            if (
              links.findIndex(
                (c) => (c[0] === idx1 && c[1] === idx2) || (c[0] === idx2 && c[1] === idx1),
              ) === -1
            ) {
              if (this.random() < 0.2) {
                links.push([idx1, idx2, true]);
              }
            }
          }
        }
      }
    }

    return links;
  }

  private linkRooms() {
    const tasks = this.createLinkTasks();
    this.links.length = 0;

    // Direct links
    for (const [idx1, idx2, optional] of tasks) {
      const room1 = this.rooms[idx1];
      const room2 = this.rooms[idx2];
      const overlap = this.getRoomIntersection(room1, room2);
      if (overlap) {
        const tiles: GeneratorTileType[] = Array(overlap.length).fill(GeneratorTileType.Wall);
        let transparent = false;
        const allowJoin =
          room1.links.findIndex((l) => l.transparent) === -1 &&
          room2.links.findIndex((l) => l.transparent) === -1;

        if (this.random() < 0.6 || !allowJoin || optional) {
          const off = this.randomInt(overlap.length - 3) + 1;
          tiles[off] = GeneratorTileType.Door;
        } else {
          tiles.fill(GeneratorTileType.None);
          transparent = true;
        }

        // TODO: Optional fence wall

        const link: GeneratorLink = {
          room1,
          room2,
          transparent,
          tiles,
          ...overlap,
        };
        room1.links.push(link);
        room2.links.push(link);
        this.links.push(link);

        for (let i = 0; i < overlap.length; i++) {
          const x = overlap.x + (!overlap.vertical ? i : 0);
          const y = overlap.y + (overlap.vertical ? i : 0);
          this.map[y][x] = tiles[i];
        }
      }
    }
  }

  private assignMainRooms() {
    const deadEnds = this.rooms.filter((r) => r.links.length === 1);
    if (deadEnds.length === 0) {
      deadEnds.push(...this.rooms);
    }

    const start = deadEnds.shift()!;
    if (deadEnds.length === 0) {
      deadEnds.push(...this.rooms.filter((r) => r !== start));
    }

    const cx = start.x + start.width / 2;
    const cy = start.y + start.height / 2;

    const end = deadEnds
      .map((r) => ({
        room: r,
        distance: Math.hypot(r.x + r.width / 2 - cx, r.y + r.height / 2 - cy),
      }))
      .sort((a, b) => a.distance - b.distance)
      .pop()!.room;

    this.startRoom = start;
    this.endRoom = end;
  }

  private canPlaceRoom(room: LinkedGeneratorRoom) {
    for (const other of this.rooms) {
      if (other !== room && this.isRoomsOverlap(room, other, 1)) {
        return false;
      }
    }

    return true;
  }

  private isRoomsOverlap(
    room: LinkedGeneratorRoom,
    other: LinkedGeneratorRoom,
    padding: number = 0,
  ) {
    return !(
      other.x + other.width + padding <= room.x ||
      other.y + other.height + padding <= room.y ||
      other.x - padding >= room.x + room.width ||
      other.y - padding >= room.y + room.height
    );
  }

  private getRoomIntersection(
    room: LinkedGeneratorRoom,
    other: LinkedGeneratorRoom,
  ): RoomIntersection | null {
    if (room.x + room.width === other.x - 1 || other.x + other.width === room.x - 1) {
      const x = room.x > other.x ? room.x - 1 : other.x - 1;
      const start = Math.max(room.y, other.y);
      const end = Math.min(room.y + room.height, other.y + other.height);
      const length = end - start;

      if (length >= 3) {
        return {
          x,
          y: start,
          length,
          vertical: true,
        };
      }
    }
    if (room.y + room.height === other.y - 1 || other.y + other.height === room.y - 1) {
      const y = room.y > other.y ? room.y - 1 : other.y - 1;
      const start = Math.max(room.x, other.x);
      const end = Math.min(room.x + room.width, other.x + other.width);
      const length = end - start;
      if (length >= 3) {
        return {
          y,
          x: start,
          length,
          vertical: false,
        };
      }
    }

    return null;
  }

  private getRoomIndex(room: LinkedGeneratorRoom) {
    return this.rooms.indexOf(room);
  }

  private validateMap() {
    const targetQuota = this.width * this.height * 0.5;
    let quota = 0;
    for (const room of this.rooms) {
      quota += room.width * room.height;
    }

    return targetQuota <= quota;
  }
}
