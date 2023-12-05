import { vec2, vec3, vec4 } from 'gl-matrix';
import { Controls } from '../core/Controls.ts';
import { screenSize } from '../core/GL.ts';
import { Camera } from '../engine/Camera.ts';
import { Navigation } from '../engine/Navigation.ts';
import { Renderer, RenderTask } from '../engine/Renderer.ts';
import { Screen } from '../engine/Screen.ts';
import { PlayerActor } from '../entities/actors/PlayerActor.ts';
import { Door } from '../entities/objects/Door.ts';
import { LevelObject } from '../entities/objects/LevelObject.ts';
import { DebugDungeonGenerator } from '../generators/dungeon/DebugDungeonGenerator.ts';
import { DungeonGenerator, GeneratorTileType } from '../generators/dungeon/DungeonGenerator.ts';
import { RoomGenerator } from '../generators/room/RoomGenerator.ts';
import { SimpleRoomGenerator } from '../generators/room/SimpleRoomGenerator.ts';
import { RoomTriangulator } from '../generators/trimesh/RoomTriangulator.ts';
import { SimpleRoomTriangulator } from '../generators/trimesh/SimpleRoomTriangulator.ts';
import { intersectRayBox, intersectRayPlane } from '../helpers/Intersections.ts';
import { VisibilityManager } from '../managers/VisibilityManager.ts';
import { DungeonMesh } from '../rendering/dungeon/DungeonMesh.ts';

const FORCE_SEED: string | null = null; // '1701264374046';

interface Path {
  points: vec2[];
  radius: number[];
  current: number;
  activate: LevelObject | null;
}

export class GameTestScreen extends Screen {
  private readonly generator: DungeonGenerator;

  private readonly roomGenerator: RoomGenerator;

  private readonly triangulator: RoomTriangulator;

  private readonly staticMesh: DungeonMesh;

  private readonly player: PlayerActor;

  private playerPath: Path | null;

  private angle: number = 0;

  private hoverObject: LevelObject | null;

  private readonly objects: LevelObject[] = [];

  private readonly navigation: Navigation;

  public constructor(private readonly theme: number = 2) {
    super();

    const seed = FORCE_SEED !== null ? FORCE_SEED : (+new Date()).toString();

    // this.generator = new SimpleDungeonGenerator(seed, 30, 30);
    this.generator = new DebugDungeonGenerator(seed, 30, 30);
    this.generator.generate();

    this.roomGenerator = new SimpleRoomGenerator(
      seed,
      theme,
      this.generator.getBlockMap(),
      this.generator.getRooms(),
      this.generator.getLinks(),
    );
    this.roomGenerator.generate();

    this.triangulator = new SimpleRoomTriangulator(
      this.roomGenerator.getRooms(),
      this.roomGenerator.getLinks(),
    );
    this.triangulator.triangulate();

    this.staticMesh = new DungeonMesh(this.triangulator.getRooms(), this.triangulator.getLinks());

    const [start] = this.generator.getMainRooms();
    this.player = new PlayerActor();
    this.player.position = vec2.fromValues(
      start.x + start.width / 2 + 0.5,
      start.y + start.height / 2 + 0.5,
    );
    this.playerPath = null;
    this.hoverObject = null;
    this.navigation = new Navigation(this.generator.getRooms(), this.generator.getLinks());

    VisibilityManager.rebuild(this.generator.getRooms(), this.generator.getLinks());
    VisibilityManager.reveal(this.generator.getRooms().indexOf(start));

    const doors: Door[] = [];
    for (const link of this.generator.getLinks()) {
      for (let i = 0; i < link.length; i++) {
        const t = link.tiles[i];
        if (t === GeneratorTileType.Door) {
          const px = link.x + (!link.vertical ? i : 0);
          const pz = link.y + (link.vertical ? i : 0);
          const idx1 = this.generator.getRooms().indexOf(link.room1);
          const idx2 = this.generator.getRooms().indexOf(link.room2);
          const door = new Door(px, pz, link.vertical, theme, idx1, idx2);

          this.objects.push(door);
          doors.push(door);
        }
      }
    }
    this.navigation.setDoors(doors);
  }

  public update(delta: number): void {
    const mouse = Controls.getMouse();

    VisibilityManager.update(delta);

    this.updatePlayer(delta);
    this.updateCamera(delta);
    for (const obj of this.objects) {
      obj.update(delta);
    }

    const [origin, direction] = Camera.projectRay(
      vec2.fromValues(mouse[0] / screenSize[0], mouse[1] / screenSize[1]),
    );

    this.hoverObject = null;

    const point = vec3.create();
    let dist = Infinity;
    this.hoverObject = null;
    for (const obj of this.objects) {
      const box = obj.getBox();
      if (box) {
        if (intersectRayBox(point, origin, direction, box[0], box[1])) {
          const sqDist = vec3.sqrDist(origin, point);
          if (sqDist < dist) {
            dist = sqDist;
            this.hoverObject = obj;
          }
        }
      }
    }

    if (Controls.mouseHit()) {
      if (this.hoverObject) {
        const [target, radius] = this.hoverObject.getDestination();
        this.navigatePlayer(target, radius, this.hoverObject);
      } else if (intersectRayPlane(point, origin, direction, [0, 1, 0], 0)) {
        this.navigatePlayer(vec2.fromValues(point[0], point[2]), 0, null);
      }
    }
  }

  public render(): void {
    const tasks: RenderTask[] = [
      ...this.staticMesh.getRenderTasks(this.player.position), //
      ...this.player.getRenderTask(),
      ...this.objects.flatMap((obj) =>
        obj.getRenderTask().map((t) => ({
          ...t,
          outline: obj === this.hoverObject,
        })),
      ),
    ];

    const pos = this.player.position;

    Renderer.renderDeferred(
      [pos[0], 0.5, pos[1]],
      tasks,
      [
        ...this.staticMesh.getLights(),
        {
          position: [pos[0] + 0.1, 1.3, pos[1] + 0.3],
          color: [0.2, 0.3, 0.3],
          range: 5,
        },
      ],
      vec4.fromValues(0, 1, 0, 1),
    );
  }

  public renderUI(): void {}

  private updateCamera(delta: number) {
    const camPos = vec2.clone(this.player.position);

    // const maxDiff = 3;
    // const targetDiff = vec2.sub(vec2.create(), this.target, this.player.position);
    // if (vec2.len(targetDiff) > maxDiff) {
    //   vec2.normalize(targetDiff, targetDiff);
    //   vec2.scale(targetDiff, targetDiff, maxDiff);
    // }
    // this.cameraOffset[0] = damp(this.cameraOffset[0], targetDiff[0], 0.04, delta);
    // this.cameraOffset[1] = damp(this.cameraOffset[1], targetDiff[1], 0.04, delta);
    //
    // vec2.scaleAndAdd(camPos, camPos, this.cameraOffset, 0);

    const ph = -0.5;
    const dist = 5;
    const distY = dist * 1.5;
    const px = camPos[0];
    const py = camPos[1];
    Camera.lookAt([dist + px, distY + ph, dist + py], [px, ph, py]);
  }

  private updatePlayer(delta: number) {
    const SPEED = 0.04 * delta;
    let moving = false;
    if (this.playerPath) {
      moving = true;
      const c = this.playerPath.current;
      const dist = vec2.distance(this.player.position, this.playerPath.points[c]);
      if (dist <= this.playerPath.radius[c]) {
        this.playerPath.current++;
        if (this.playerPath.current === this.playerPath.points.length) {
          if (this.playerPath.activate) {
            this.playerPath.activate.activate(this.player.position);
          }
          this.playerPath = null;
          moving = false;
        }
      } else {
        const move = Math.min(dist, SPEED);
        const dir = vec2.sub(vec2.create(), this.playerPath.points[c], this.player.position);
        this.angle = Math.atan2(dir[0], dir[1]);
        vec2.normalize(dir, dir);
        vec2.scale(dir, dir, move);
        vec2.add(dir, dir, this.player.position);
        this.player.position = dir;
      }
    }

    this.player.setRunning(moving);
    this.player.faceAngle(this.angle, delta, 0.15);
    this.player.update(delta);
  }

  private navigatePlayer(target: vec2, radius: number, targetObject: LevelObject | null) {
    const path = this.navigation.buildPath(this.player.position, target, radius, targetObject);
    if (path) {
      this.playerPath = {
        current: 0,
        points: path.map((n) => n.position),
        radius: path.map((n) => (n.radius === 0 ? 0.01 : n.radius)),
        activate: targetObject,
      };
    }
  }
}
