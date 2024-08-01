import { mat3, mat4, quat, vec2, vec3 } from 'gl-matrix';
import { ClickableObject } from '@/entities/ClickableObject.ts';
import { GL } from '../../core/GL.ts';
import { RenderTask } from '../../engine/Renderer.ts';
import { Shader } from '../../engine/Shader.ts';
import { easeInOutQuad } from '../../helpers/Easings.ts';
import { createIndexBuffer, createVertexBuffer } from '../../helpers/GLHelpers.ts';
import { buildTangents } from '../../helpers/Tangents.ts';
import { TilesManager } from '../../managers/TilesManager.ts';
import { VisibilityManager } from '../../managers/VisibilityManager.ts';

import TileFrag from '../../shaders/entities/tile.frag.glsl?raw';
import TileVert from '../../shaders/entities/tile.vert.glsl?raw';
import { LevelObject } from './LevelObject.ts';

interface DoorSurface {
  vertices: WebGLBuffer;
  tangents: WebGLBuffer;
  indices: WebGLBuffer;
  indexCount: number;
}

const DOOR_OFFSET = [0.351, 0.435, 0.353, 0.441, 0];
const DOOR_SUBROT = [
  [0, Math.PI],
  [0, Math.PI],
  [Math.PI, 0],
  [0, Math.PI],
  [0, Math.PI],
];

/**
 * Level door
 */
export class Door extends LevelObject implements ClickableObject {
  /**
   * Cached meshes for every dungeon theme
   * @private
   */
  private static readonly surfaces: DoorSurface[][] = [];

  /**
   * Door shader
   * @private
   */
  private static shader: Shader;

  /**
   * Picking box center
   * @private
   */
  private readonly boxCenter: vec3;

  /**
   * Picking box size
   * @private
   */
  private readonly boxSize: vec3;

  /**
   * Flag for opened door
   * @private
   */
  private opened: boolean = false;

  /**
   * Opening state
   * @private
   */
  private state: number = 0;

  /**
   * Opening direction (1 or -1)
   * @private
   */
  private stateSide: number = 0;

  /**
   * Door skin - 0 or 1
   * @private
   */
  private readonly skin: number;

  /**
   * Is door open
   */
  public get isOpen() {
    return this.opened;
  }

  /**
   * Create door
   * @param x
   * @param y
   * @param vertical
   * @param theme
   * @param group1
   * @param group2
   */
  public constructor(
    public x: number,
    public y: number,
    private readonly vertical: boolean,
    private readonly theme: number,
    private readonly group1: number,
    private readonly group2: number,
  ) {
    super();
    const height = 1.3;
    const width = 0.9;
    const thick = 0.4;
    this.position = vec2.fromValues(x + 0.5, y + 0.5);
    this.rotation = vertical ? Math.PI * 0.5 : 0;
    this.boxCenter = vec3.fromValues(x + 0.5, height / 2, y + 0.5);
    this.boxSize = vec3.fromValues(!vertical ? width : thick, height, vertical ? width : thick);
    this.sphere.center = [x + 0.5, height / 2, y + 0.5];
    this.sphere.radius = height;
    this.skin = Math.random() >= 0.5 ? 1 : 0;

    this.render = this.render.bind(this);

    // Cache mesh
    if (!Door.surfaces[theme]) {
      Door.surfaces[theme] = [];
      for (let i = 0; i < 2; i++) {
        const tile = TilesManager.getTile('door', theme, i);
        if (tile) {
          let max = 0;
          for (let j = 0; j < tile.vertices.length; j += 8) {
            max = Math.max(max, tile.vertices[j]);
          }
          Door.surfaces[theme][i] = {
            vertices: createVertexBuffer(new Float32Array(tile.vertices)),
            indices: createIndexBuffer(new Uint16Array(tile.indices)),
            tangents: createVertexBuffer(
              new Float32Array(buildTangents(tile.vertices, tile.indices)),
            ),
            indexCount: tile.indices.length,
          };
        }
      }
    }
    if (!Door.shader) {
      Door.shader = new Shader(TileFrag, TileVert, {
        deferred: true,
      });
    }
  }

  /**
   * Get task for render
   */
  public getRenderTask(): RenderTask[] {
    if (
      VisibilityManager.roomState(this.group1) > 0 ||
      VisibilityManager.roomState(this.group2) > 0
    ) {
      return [
        {
          sphere: this.cullSphere,
          draw: this.render,
        },
      ];
    }

    return [];
  }

  /**
   * Update door logic
   * @param delta
   */
  public update(delta: number): void {
    if (this.opened) {
      this.state = Math.min(this.state + delta * 0.03, 1);
    }
  }

  /**
   * Get picking AABB
   */
  public getBox() {
    if (!this.opened) {
      return [this.boxCenter, this.boxSize] as const;
    }

    return null;
  }

  /**
   * Get navigation destination
   */
  public getDestination(): readonly [vec2, number] {
    return [this.position, 0.5];
  }

  /**
   * Activate by player
   * @param player
   */
  public activate(player: vec2) {
    if (!this.opened) {
      VisibilityManager.reveal(this.group1);
      VisibilityManager.reveal(this.group2);
      this.opened = true;

      const neg = this.vertical ? player[0] < this.position[0] : player[1] < this.position[1];
      this.stateSide = neg ? -1 : 1;
    }
  }

  /**
   * Render door mesh
   * @private
   */
  private render() {
    const geom = Door.surfaces[this.theme][this.skin];
    if (!geom) {
      return;
    }
    const shader = Door.shader;
    const [diffuse, normal] = TilesManager.getTextures();
    const reveal = Math.max(
      VisibilityManager.roomState(this.group1),
      VisibilityManager.roomState(this.group2),
    );

    const factor = easeInOutQuad(this.state) * this.stateSide;

    for (let i = 0; i < 2; i++) {
      const mat = mat4.create();
      const rot = quat.setAxisAngle(
        quat.create(),
        [0, 1, 0],
        i === 1
          ? Math.PI - Math.PI * 0.5 * factor - DOOR_SUBROT[this.theme][this.skin]
          : Math.PI * 0.5 * factor + DOOR_SUBROT[this.theme][this.skin],
      );
      mat4.fromRotationTranslation(
        mat,
        rot,
        vec3.fromValues((i === 0 ? -1 : 1) * DOOR_OFFSET[this.theme], 0, 0),
      );
      mat4.multiply(mat, this.matrix, mat);

      const normMat = mat3.fromQuat(mat3.create(), rot);
      mat3.multiply(normMat, this.normalMatrix, normMat);

      shader.updateMatrix(mat);
      shader.bind();
      shader.setTexture('uDiffuse', diffuse);
      shader.setTexture('uNormal', normal);
      shader.setBuffer('position', geom.vertices, 3, GL.FLOAT, false, 32, 0);
      shader.setBuffer('normal', geom.vertices, 3, GL.FLOAT, false, 32, 3 * 4);
      shader.setBuffer('uv', geom.vertices, 2, GL.FLOAT, false, 32, 6 * 4);
      shader.setBuffer('tangent', geom.tangents, 3, GL.FLOAT);
      GL.uniform1f(shader.uniform('uReveal'), reveal);
      GL.uniformMatrix3fv(shader.uniform('normalMat'), false, normMat);
      shader.draw(geom.indices, geom.indexCount, GL.TRIANGLES, GL.UNSIGNED_SHORT);

      shader.unbind();
    }
  }
}
