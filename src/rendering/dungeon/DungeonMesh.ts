import { vec2, vec3, vec4 } from 'gl-matrix';
import { GL, screenSize } from '../../core/GL.ts';
import { CullSphere } from '../../engine/CullSphere.ts';
import { PointLight, RenderTask } from '../../engine/Renderer.ts';
import { Shader } from '../../engine/Shader.ts';
import { MeshLink, MeshRoom, MeshSurface } from '../../generators/trimesh/RoomTriangulator.ts';
import { easeInOutQuad, easeOutQuart } from '../../helpers/Easings.ts';
import { createIndexBuffer, createVertexBuffer } from '../../helpers/GLHelpers.ts';
import { TilesManager } from '../../managers/TilesManager.ts';
import { VisibilityManager } from '../../managers/VisibilityManager.ts';
import ShaderFrag from '../../shaders/dungeon/dungeon.frag.glsl?raw';
import ShaderVert from '../../shaders/dungeon/dungeon.vert.glsl?raw';
import TrimShaderFrag from '../../shaders/dungeon/dungeon_trim.frag.glsl?raw';
import TrimShaderVert from '../../shaders/dungeon/dungeon_trim.vert.glsl?raw';

interface MeshContainer {
  vao: WebGLVertexArrayObject;
  buffer: WebGLBuffer;
  tangentBuffer?: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  indexCount: number;
}

interface RoomGeometry extends MeshContainer {
  room: MeshRoom;
  sphere: CullSphere;

  outline?: MeshContainer;
}

interface LinkGeometry extends MeshContainer {
  link: MeshLink;
  sphere: CullSphere;

  outline?: MeshContainer;
}

export class DungeonMesh {
  private readonly rooms: RoomGeometry[];

  private readonly links: LinkGeometry[];

  private readonly shader: Shader;

  private readonly blackShader: Shader;

  public constructor(rooms: MeshRoom[], links: MeshLink[]) {
    this.shader = new Shader(ShaderFrag, ShaderVert, true);
    this.blackShader = new Shader(TrimShaderFrag, TrimShaderVert, true);
    this.rooms = [];
    this.links = [];
    for (const room of rooms) {
      this.rooms.push({
        room,
        sphere: CullSphere.fromPointCloud(room.vertexData, 5),
        outline: room.outline ? this.createOutline(room.outline) : undefined,

        ...this.createMesh(room),
      });
    }
    for (const link of links) {
      this.links.push({
        link,

        sphere: CullSphere.fromPointCloud(link.vertexData, 5),
        outline: link.outline ? this.createOutline(link.outline) : undefined,

        ...this.createMesh(link),
      });
    }
  }

  public getRenderTasks(playerPos: vec2): RenderTask[] {
    const clipSize = 3;
    const clip = vec4.fromValues(
      playerPos[0] + clipSize / 2,
      clipSize + 0.1,
      playerPos[1] + clipSize / 2,
      clipSize,
    );
    const px = Math.floor(playerPos[0]);
    const py = Math.floor(playerPos[1]);
    for (const r of this.rooms) {
      const room = r.room.decoratedRoom.generatorRoom;
      if (room.x <= px && room.y <= py && room.x + room.width > px && room.y + room.height > py) {
        clip[0] = Math.max(clip[0] - clipSize, room.x) + clipSize;
        clip[2] = Math.max(clip[2] - clipSize, room.y) + clipSize;
      }
    }

    const player = vec3.fromValues(playerPos[0], 0.05, playerPos[1]);

    const tasks: RenderTask[] = [];
    for (let idx = 0; idx <= this.rooms.length; idx++) {
      const state = easeInOutQuad(VisibilityManager.roomState(idx));
      if (state > 0) {
        const geom = this.rooms[idx];
        const id = idx;
        tasks.push({
          sphere: geom.sphere,
          draw: (shadowPass) => this.renderRoom(id, !shadowPass ? player : [1000, 0, 1000], clip),
        });
      }
    }
    for (let idx = 0; idx <= this.links.length; idx++) {
      const state = VisibilityManager.linkState(idx);
      if (state > 0) {
        const geom = this.links[idx];
        const id = idx;
        tasks.push({
          sphere: geom.sphere,
          draw: (shadowPass) => this.renderLink(id, !shadowPass ? player : [1000, 0, 1000], clip),
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
            color: [1.0 * state, 0.5 * state, 0.0 * state],
            range: (6 + Math.sin(stime) * Math.sin(stime * 0.6 - 13) * 0.2) * state,
          });
        }
      }
    }

    return lights;
  }

  private renderRoom(index: number, playerPos: vec3, clipSphere: vec4) {
    this.renderMesh(this.rooms[index], VisibilityManager.roomState(index), playerPos, clipSphere);
  }

  private renderLink(index: number, playerPos: vec3, clipSphere: vec4) {
    this.renderMesh(this.links[index], VisibilityManager.linkState(index), playerPos, clipSphere);
  }

  private renderMesh(
    geom: RoomGeometry | LinkGeometry,
    reveal: number,
    playerPos: vec3,
    clipSphere: vec4,
  ) {
    const [diffuse, normal] = TilesManager.getTextures();
    this.shader.bind();
    this.shader.setTexture('uDiffuse', diffuse);
    this.shader.setTexture('uNormal', normal);
    GL.uniform3fv(this.shader.uniform('uPlayer'), playerPos);
    GL.uniform4fv(this.shader.uniform('uClipSphere'), clipSphere);
    GL.uniform1f(this.shader.uniform('uAspect'), screenSize[0] / screenSize[1]);
    GL.bindVertexArray(geom.vao);

    for (let i = 1; i >= 0; i--) {
      GL.cullFace(i === 0 ? GL.FRONT : GL.BACK);
      GL.uniform1f(this.shader.uniform('uReveal'), reveal * i);
      this.shader.draw(geom.indexBuffer, geom.indexCount, GL.TRIANGLES, GL.UNSIGNED_SHORT);
    }
    GL.cullFace(GL.BACK);

    GL.bindVertexArray(null);
    this.shader.unbind();

    if (geom.outline) {
      this.blackShader.bind();
      GL.bindVertexArray(geom.outline.vao);
      GL.uniform3fv(this.blackShader.uniform('uPlayerClip'), playerPos);
      GL.uniform1f(this.blackShader.uniform('uAspect'), screenSize[0] / screenSize[1]);
      this.blackShader.draw(
        geom.outline.indexBuffer,
        geom.outline.indexCount,
        GL.TRIANGLES,
        GL.UNSIGNED_SHORT,
      );

      GL.bindVertexArray(null);
      this.blackShader.unbind();
    }
  }

  public dispose() {}

  private createMesh(room: MeshRoom | MeshLink): MeshContainer {
    const buffer = createVertexBuffer(new Float32Array(room.vertexData), GL.STATIC_DRAW);
    const indexBuffer = createIndexBuffer(new Uint16Array(room.indexData));
    const tangentBuffer = room.tangentData
      ? createVertexBuffer(new Float32Array(room.tangentData))
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
      indexCount: room.indexData.length,
    };
  }

  private createOutline(mesh: MeshSurface): MeshContainer {
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
    };
  }
}
