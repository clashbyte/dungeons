import { vec3 } from 'gl-matrix';
import { LevelObject } from '@/entities/objects/LevelObject.ts';
import { GL } from '@/core/GL.ts';
import { CullSphere } from '@/engine/CullSphere.ts';
import { RenderTask } from '@/engine/Renderer.ts';
import { Shader } from '@/engine/Shader.ts';
import { SceneryTileHint } from '@/generators/decoration/SimpleRoomDecorator.ts';
import { TriangulatedRoom } from '@/generators/trimesh/RoomTriangulator.ts';
import { createIndexBuffer, createVertexBuffer } from '@/helpers/GLHelpers.ts';
import { buildTangents } from '@/helpers/Tangents.ts';
import { TilesManager } from '@/managers/TilesManager.ts';
import { VisibilityManager } from '@/managers/VisibilityManager.ts';
import ShaderFrag from '@/shaders/dungeon/dungeon.frag.glsl';
import ShaderVert from '@/shaders/dungeon/dungeon.vert.glsl';

interface TileMeshEntry {
  vao: WebGLVertexArrayObject;
  vertexBuffer: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  tangentBuffer: WebGLBuffer;
  indexCount: number;
  sphere: CullSphere;
}

export class StaticObject extends LevelObject {
  private static shader: Shader;

  private static readonly tileCache: { [key: string]: TileMeshEntry } = {};

  private readonly entry: TileMeshEntry | null;

  private readonly sphere: CullSphere | null;

  private static cacheTile(name: string, group: number, variant: number): TileMeshEntry | null {
    const key = [name, group, variant].join('_');
    if (this.tileCache[key]) {
      return this.tileCache[key];
    }
    const tile = TilesManager.getTile(name, group, variant);
    if (tile) {
      const { vertices, indices } = tile;
      const tangents = buildTangents(vertices, indices);

      const vertexBuffer = createVertexBuffer(new Float32Array(vertices), GL.STATIC_DRAW);
      const indexBuffer = createIndexBuffer(new Uint16Array(indices));
      const tangentBuffer = createVertexBuffer(new Float32Array(tangents));

      const vao = GL.createVertexArray()!;
      GL.bindVertexArray(vao);
      this.shader.bind();
      this.shader.setBuffer('position', vertexBuffer, 3, GL.FLOAT, false, 32, 0);
      this.shader.setBuffer('normal', vertexBuffer, 3, GL.FLOAT, false, 32, 3 * 4);
      this.shader.setBuffer('uv', vertexBuffer, 2, GL.FLOAT, false, 32, 6 * 4);
      if (tangentBuffer) {
        this.shader.setBuffer('tangent', tangentBuffer, 3, GL.FLOAT);
      }
      GL.bindVertexArray(null);
      this.shader.unbind();

      const entry: TileMeshEntry = {
        vertexBuffer,
        indexBuffer,
        tangentBuffer,
        vao,
        indexCount: indices.length,
        sphere: CullSphere.fromPointCloud(vertices, 5),
      };
      this.tileCache[key] = entry;

      return entry;
    }

    return null;
  }

  public constructor(
    private readonly room: TriangulatedRoom,
    private readonly roomIndex: number,
    private readonly hint: SceneryTileHint,
  ) {
    super();
    if (!StaticObject.shader) {
      StaticObject.shader = new Shader(ShaderFrag, ShaderVert, {
        deferred: true,
        defines: {
          NORMAL_MAT: 'true',
        },
      });
    }

    this.entry = StaticObject.cacheTile(hint.name, hint.group, hint.variant);
    this.sphere = null;

    this.position = [
      hint.x + 0.5 + room.decoratedRoom.generatorRoom.x,
      hint.y + 0.5 + room.decoratedRoom.generatorRoom.y,
    ];
    this.rotation = (hint.angle ?? 0) * (-Math.PI / 2);
    this.scale = hint.scale ?? 1;
    this.height = hint.height ?? 0;

    if (this.entry) {
      const pos = vec3.clone(this.entry.sphere.center);
      vec3.transformMat4(pos, pos, this.matrix);
      this.sphere = new CullSphere(pos, this.entry.sphere.radius * this.scale);
    }
  }

  public getRenderTask(): RenderTask[] {
    if (this.entry && this.sphere && VisibilityManager.roomState(this.roomIndex)) {
      return [
        {
          draw: () => this.drawMesh(),
          sphere: this.sphere,
        },
      ];
    }

    return [];
  }

  private drawMesh() {
    const { shader } = StaticObject;
    const [diffuse, normal] = TilesManager.getTextures();
    const surf = this.entry!;

    shader.updateMatrix(this.matrix);
    shader.bind();
    shader.setTexture('uDiffuse', diffuse);
    shader.setTexture('uNormal', normal);
    GL.uniform1f(shader.uniform('uAlpha'), 1);
    GL.uniformMatrix3fv(shader.uniform('normalMat'), false, this.normalMatrix);
    GL.bindVertexArray(surf.vao);

    GL.uniform1f(shader.uniform('uReveal'), VisibilityManager.roomState(this.roomIndex));
    shader.draw(surf.indexBuffer, surf.indexCount, GL.TRIANGLES, GL.UNSIGNED_SHORT);

    GL.bindVertexArray(null);
    shader.unbind();
  }
}
