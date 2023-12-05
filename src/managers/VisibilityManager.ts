import { GeneratorLink, GeneratorRoom } from '../generators/dungeon/DungeonGenerator.ts';

interface RoomGroup {
  rooms: number[];
  links: number[];
  active: boolean;
}

export class VisibilityManager {
  private static readonly roomVisible: boolean[] = [];

  private static readonly linkVisible: boolean[] = [];

  private static readonly roomFactor: number[] = [];

  private static readonly linkFactor: number[] = [];

  private static readonly groups: RoomGroup[] = [];

  public static rebuild(rooms: GeneratorRoom[], links: GeneratorLink[]) {
    this.groups.length = 0;
    this.roomVisible.length = 0;
    this.linkVisible.length = 0;
    this.roomFactor.length = 0;
    this.linkFactor.length = 0;

    const visitedRooms: number[] = [];
    for (let i = 0; i < links.length; i++) {
      this.linkFactor[i] = 0;
      this.linkVisible[i] = false;
      const l = links[i];
      if (l.transparent) {
        const room1 = rooms.indexOf(l.room1);
        const room2 = rooms.indexOf(l.room2);

        if (!visitedRooms.includes(room1)) {
          visitedRooms.push(room1);
        }
        if (!visitedRooms.includes(room2)) {
          visitedRooms.push(room2);
        }

        let item = this.groups.find((g) => g.rooms.includes(room1) || g.rooms.includes(room2));
        if (!item) {
          item = {
            rooms: [room1, room2],
            links: [i],
            active: false,
          };
          this.groups.push(item);
        } else {
          if (!item.rooms.includes(room1)) {
            item.rooms.push(room1);
          }
          if (!item.rooms.includes(room2)) {
            item.rooms.push(room2);
          }
          item.links.push(i);
        }
      }
    }
    for (let i = 0; i < rooms.length; i++) {
      this.roomFactor[i] = 0;
      this.roomVisible[i] = false;
      if (!visitedRooms.includes(i)) {
        this.groups.push({
          rooms: [i],
          links: [],
          active: false,
        });
      }
    }
    for (let i = 0; i < links.length; i++) {
      const l = links[i];
      if (!l.transparent) {
        const room1 = rooms.indexOf(l.room1);
        const room2 = rooms.indexOf(l.room2);
        for (const idx of [room1, room2]) {
          const item = this.groups.find((g) => g.rooms.includes(idx));
          if (item) {
            item.links.push(i);
          }
        }
      }
    }
  }

  public static reveal(room: number, instant: boolean = false) {
    const group = this.groups.find((g) => g.rooms.includes(room));
    if (group) {
      for (const idx of group.rooms) {
        this.roomVisible[idx] = true;
        this.roomFactor[idx] = instant ? 1 : this.roomFactor[idx] ?? 0;
      }
      for (const idx of group.links) {
        this.linkVisible[idx] = true;
        this.linkFactor[idx] = instant ? 1 : this.linkFactor[idx] ?? 0;
      }
    }
  }

  public static roomState(index: number) {
    return this.roomFactor[index] ?? 0;
  }

  public static linkState(index: number) {
    return this.linkFactor[index] ?? 0;
  }

  public static update(delta: number) {
    for (let i = 0; i < this.roomVisible.length; i++) {
      if (this.roomVisible[i]) {
        this.roomFactor[i] = Math.min((this.roomFactor[i] ?? 0) + 0.03 * delta, 1);
      }
    }
    for (let i = 0; i < this.linkVisible.length; i++) {
      if (this.linkVisible[i]) {
        this.linkFactor[i] = Math.min((this.linkFactor[i] ?? 0) + 0.03 * delta, 1);
      }
    }
  }
}
