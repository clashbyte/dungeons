import { vec2, vec3 } from 'gl-matrix';
import { GL, screenSize } from '@/core/GL.ts';
import { CullSphere } from '@/engine/CullSphere.ts';
import { PointLight, RenderTask } from '@/engine/Renderer.ts';
import { Shader } from '@/engine/Shader.ts';
import {
  TriangulatedLink,
  TriangulatedRoom,
  TriangulatedSurface,
} from '@/generators/trimesh/RoomTriangulator.ts';
import { easeInOutQuad, easeOutQuart } from '@/helpers/Easings.ts';
import { createIndexBuffer, createVertexBuffer } from '@/helpers/GLHelpers.ts';
import { saturate } from '@/helpers/MathUtils.ts';
import { TilesManager } from '@/managers/TilesManager.ts';
import { VisibilityManager } from '@/managers/VisibilityManager.ts';
import ShaderFrag from '@/shaders/dungeon/dungeon.frag.glsl';
import ShaderVert from '@/shaders/dungeon/dungeon.vert.glsl';
import TrimShaderFrag from '@/shaders/dungeon/dungeon_trim.frag.glsl';
import TrimShaderVert from '@/shaders/dungeon/dungeon_trim.vert.glsl';

interface MeshSurface {
  vao: WebGLVertexArrayObject;
  buffer: WebGLBuffer;
  tangentBuffer?: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  indexCount: number;
  sphere: CullSphere;
}

interface MeshGroup {
  walls: MeshSurface[];
  outline: MeshSurface[];
  wallState: number[];
  floor: MeshSurface;
}

interface RoomGeometry extends MeshGroup {
  room: TriangulatedRoom;
}

interface LinkGeometry extends MeshGroup {
  link: TriangulatedLink;
}

export class DungeonMesh {
  private readonly rooms: RoomGeometry[];

  private readonly links: LinkGeometry[];

  private readonly shader: Shader;

  private readonly blackShader: Shader;

  public constructor(rooms: TriangulatedRoom[], links: TriangulatedLink[]) {
    this.shader = new Shader(ShaderFrag, ShaderVert, {
      deferred: true,
    });
    this.blackShader = new Shader(TrimShaderFrag, TrimShaderVert, {
      deferred: true,
    });
    this.rooms = [];
    this.links = [];
    for (const room of rooms) {
      this.rooms.push({
        room,
        walls: room.walls.map((surf) => this.createMesh(surf)),
        outline: room.wallOutline!.map((surf) => this.createOutline(surf)),
        wallState: Array(8).fill(1),
        floor: this.createMesh(room.floor),
      });
    }
    for (const link of links) {
      this.links.push({
        link,
        walls: link.walls.map((surf, idx) => this.createMesh(surf)),
        outline: link.wallOutline!.map((surf) => this.createOutline(surf)),
        wallState: Array(8).fill(1),
        floor: this.createMesh(link.floor),
      });
    }
  }

  public update(playerPos: vec2, delta: number) {
    const px = Math.floor(playerPos[0]);
    const py = Math.floor(playerPos[1]);

    const HIDE_SPEED = 0.02 * delta;
    for (let i = 0; i < this.rooms.length; i++) {
      const r = this.rooms[i];
      const gr = r.room.decoratedRoom.generatorRoom;
      const hide = [false, false, false, false];

      if (
        this.rectsOverlap(px, py, 1, gr.x - 2, gr.y, 1, gr.height) ||
        this.rectsOverlap(px, py, 1, gr.x, gr.y - 2, gr.width, 1)
      ) {
        hide[0] = true;
        hide[1] = true;
      }
      if (
        this.rectsOverlap(px, py, 1, gr.x + gr.width - 1, gr.y, 1, gr.height) ||
        this.rectsOverlap(px, py, 1, gr.x, gr.y + gr.height - 1, gr.width, 1)
      ) {
        hide[2] = true;
        hide[3] = true;
      }

      r.wallState[1] = saturate(r.wallState[1] + (hide[1] ? -1 : 1) * HIDE_SPEED);
      r.wallState[3] = saturate(r.wallState[3] + (hide[0] ? -1 : 1) * HIDE_SPEED);
      r.wallState[4] = saturate(r.wallState[4] + (hide[2] ? -1 : 1) * HIDE_SPEED);
      r.wallState[6] = saturate(r.wallState[6] + (hide[3] ? -1 : 1) * HIDE_SPEED);
      r.wallState[0] = Math.max(r.wallState[1], r.wallState[3]);
      r.wallState[2] = Math.max(r.wallState[1], r.wallState[4]);
      r.wallState[5] = Math.max(r.wallState[6], r.wallState[3]);
      r.wallState[7] = Math.max(r.wallState[6], r.wallState[4]);
    }
  }

  public getRenderTasks(): RenderTask[] {
    const tasks: RenderTask[] = [];
    for (let idx = 0; idx <= this.rooms.length; idx++) {
      const state = easeInOutQuad(VisibilityManager.roomState(idx));
      if (state > 0) {
        const geom = this.rooms[idx];
        const id = idx;
        for (let i = 0; i < 8; i++) {
          tasks.push({
            sphere: geom.walls[i].sphere,
            draw: (shadowPass) =>
              this.renderRoomSurface(
                id,
                geom.walls[i],
                geom.outline[i],
                !shadowPass ? easeInOutQuad(geom.wallState[i]) : 1,
              ),
          });
        }
        tasks.push({
          sphere: geom.floor.sphere,
          draw: () => this.renderRoomSurface(id, geom.floor, null, 1),
        });
        for (const obj of geom.room.scenery) {
          tasks.push(...obj.getRenderTask());
        }
      }
    }
    for (let idx = 0; idx <= this.links.length; idx++) {
      const state = VisibilityManager.linkState(idx);
      if (state > 0) {
        const geom = this.links[idx];
        const id = idx;
        for (let i = 0; i < 8; i++) {
          tasks.push({
            sphere: geom.walls[i].sphere,
            draw: (shadowPass) =>
              this.renderLinkSurface(
                id,
                geom.walls[i],
                geom.outline[i],
                !shadowPass ? easeInOutQuad(geom.wallState[i]) : 1,
              ),
          });
        }
        tasks.push({
          sphere: geom.floor.sphere,
          draw: () => this.renderLinkSurface(id, geom.floor, null, 1),
        });
      }
    }

    return tasks;
  }

  public getLights() {
    const lights: PointLight[] = [];
    for (let idx = 0; idx <= this.rooms.length; idx++) {
      const state = easeOutQuart(VisibilityManager.roomState(idx));
      if (state > 0) {
        const room = this.rooms[idx];
        for (const l of room.room.lights) {
          const stime = performance.now() * 0.006 + l.y + l.x;
          const xtime = performance.now() * 0.009 + l.y - l.x;
          const ytime = performance.now() * 0.008 - l.y + l.x;

          lights.push({
            position: vec3.fromValues(
              l.x + Math.sin(xtime) * Math.sin(xtime * 0.6 - 13) * 0.002,
              l.height,
              l.y + Math.sin(ytime) * Math.sin(ytime * 0.6 - 13) * 0.002,
            ),
            // color: [1.0 * state, 0.5 * state, 0.0 * state],
            color: [1.0 * state, 0.7 * state, 0.2 * state],
            range: (6 + Math.sin(stime) * Math.sin(stime * 0.6 - 13) * 0.2) * state,
          });
        }
      }
    }

    return lights;
  }

  private renderRoomSurface(
    index: number,
    surface: MeshSurface,
    outline: MeshSurface | null,
    alpha: number,
  ) {
    this.renderMesh(surface, outline, VisibilityManager.roomState(index), alpha);
  }

  private renderLinkSurface(
    index: number,
    surface: MeshSurface,
    outline: MeshSurface | null,
    alpha: number,
  ) {
    this.renderMesh(surface, outline, VisibilityManager.linkState(index), alpha);
  }

  private renderMesh(
    surf: MeshSurface,
    outlineSurf: MeshSurface | null,
    reveal: number,
    alpha: number,
  ) {
    const [diffuse, normal] = TilesManager.getTextures();
    this.shader.bind();
    this.shader.setTexture('uDiffuse', diffuse);
    this.shader.setTexture('uNormal', normal);
    GL.uniform1f(this.shader.uniform('uAlpha'), alpha);
    GL.uniform1f(this.shader.uniform('uAspect'), screenSize[0] / screenSize[1]);
    GL.bindVertexArray(surf.vao);

    for (let i = 1; i >= 0; i--) {
      GL.cullFace(i === 0 ? GL.FRONT : GL.BACK);
      GL.uniform1f(this.shader.uniform('uReveal'), reveal * i);
      this.shader.draw(surf.indexBuffer, surf.indexCount, GL.TRIANGLES, GL.UNSIGNED_SHORT);
    }
    GL.cullFace(GL.BACK);

    GL.bindVertexArray(null);
    this.shader.unbind();

    if (outlineSurf) {
      GL.disable(GL.CULL_FACE);
      this.blackShader.bind();
      GL.bindVertexArray(outlineSurf.vao);
      GL.uniform1f(this.blackShader.uniform('uAspect'), screenSize[0] / screenSize[1]);
      GL.uniform1f(this.blackShader.uniform('uAlpha'), alpha);
      this.blackShader.draw(
        outlineSurf.indexBuffer,
        outlineSurf.indexCount,
        GL.TRIANGLES,
        GL.UNSIGNED_SHORT,
      );

      GL.bindVertexArray(null);
      this.blackShader.unbind();
      GL.enable(GL.CULL_FACE);
    }
  }

  public dispose() {}

  private createMesh(surface: TriangulatedSurface): MeshSurface {
    const buffer = createVertexBuffer(new Float32Array(surface.vertexData), GL.STATIC_DRAW);
    const indexBuffer = createIndexBuffer(new Uint16Array(surface.indexData));
    const tangentBuffer = surface.tangentData
      ? createVertexBuffer(new Float32Array(surface.tangentData))
      : undefined;

    const vao = GL.createVertexArray()!;
    GL.bindVertexArray(vao);
    this.shader.bind();
    this.shader.setBuffer('position', buffer, 3, GL.FLOAT, false, 32, 0);
    this.shader.setBuffer('normal', buffer, 3, GL.FLOAT, false, 32, 3 * 4);
    this.shader.setBuffer('uv', buffer, 2, GL.FLOAT, false, 32, 6 * 4);
    if (tangentBuffer) {
      this.shader.setBuffer('tangent', tangentBuffer, 3, GL.FLOAT);
    }
    GL.bindVertexArray(null);
    this.shader.unbind();

    return {
      vao,
      buffer,
      tangentBuffer,
      indexBuffer,
      indexCount: surface.indexData.length,
      sphere: CullSphere.fromPointCloud(surface.vertexData, 5),
    };
  }

  private createOutline(mesh: TriangulatedSurface): MeshSurface {
    const buffer = createVertexBuffer(new Float32Array(mesh.vertexData), GL.STATIC_DRAW);
    const indexBuffer = createIndexBuffer(new Uint16Array(mesh.indexData));

    const vao = GL.createVertexArray()!;
    GL.bindVertexArray(vao);
    this.blackShader.bind();
    this.blackShader.setBuffer('position', buffer, 3, GL.FLOAT, false);
    GL.bindVertexArray(null);
    this.blackShader.unbind();

    return {
      vao,
      buffer,
      indexBuffer,
      indexCount: mesh.indexData.length,
      sphere: CullSphere.fromPointCloud(mesh.vertexData, 0),
    };
  }

  private rectsOverlap(
    px: number,
    py: number,
    gap: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    return !(px + gap < x || py + gap < y || px - gap >= x + width || py - gap >= y + height);
  }
}
