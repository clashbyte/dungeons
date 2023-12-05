import { mat3, mat4, quat, vec2, vec3 } from 'gl-matrix';
import { CullSphere } from '../../engine/CullSphere.ts';
import { RenderTask } from '../../engine/Renderer.ts';
import { ClickableObject } from '../ClickableObject.ts';

/**
 * Object that player can activate
 */
export abstract class LevelObject extends ClickableObject {
  /**
   * Position
   * @private
   */
  private readonly pos: vec2 = vec2.create();

  /**
   * Angle
   * @private
   */
  private rot: number = 0;

  /**
   * Scale
   * @private
   */
  private scl: number = 1;

  /**
   * Flag for matrix rebuild
   * @private
   */
  private matrixDirty: boolean = true;

  /**
   * World-space matrix
   * @private
   */
  private readonly mat: mat4 = mat4.create();

  /**
   * World-space normal matrix
   * @private
   */
  private readonly normalMat: mat3 = mat3.create();

  /**
   * Culling sphere
   * @protected
   */
  protected readonly sphere = new CullSphere(vec3.create(), 1);

  /**
   * Get object position
   */
  public get position() {
    return vec2.clone(this.pos);
  }

  /**
   * Update object position
   * @param pos
   */
  public set position(pos: vec2) {
    if (!vec2.equals(pos, this.pos)) {
      vec2.copy(this.pos, pos);
      this.matrixDirty = true;
    }
  }

  /**
   * Get object rotation
   */
  public get rotation() {
    return this.rot;
  }

  /**
   * Update object rotation
   * @param rot
   */
  public set rotation(rot: number) {
    if (rot !== this.rot) {
      this.rot = rot;
      this.matrixDirty = true;
    }
  }

  /**
   * Get object scale
   */
  public get scale() {
    return this.scl;
  }

  /**
   * Update object scale
   * @param scl
   */
  public set scale(scl: number) {
    if (scl !== this.scale) {
      this.scl = scl;
      this.matrixDirty = true;
    }
  }

  /**
   * Culling sphere
   */
  public get cullSphere() {
    vec3.set(this.sphere.center, this.pos[0], this.sphere.radius, this.pos[1]);

    return this.sphere;
  }

  /**
   * World-space matrix
   */
  public get matrix() {
    this.rebuildMatrix();

    return this.mat;
  }

  /**
   * World space normal matrix
   * @protected
   */
  protected get normalMatrix() {
    this.rebuildMatrix();

    return this.normalMat;
  }

  /**
   * Update object logic
   * @param delta
   */
  public abstract update(delta: number): void;

  /**
   * Get object render tasks
   */
  public abstract getRenderTask(): RenderTask[];

  /**
   * Rebuild world-space matrix if needed
   * @private
   */
  private rebuildMatrix() {
    if (this.matrixDirty) {
      mat4.fromRotationTranslationScale(
        this.mat,
        quat.setAxisAngle(quat.create(), vec3.fromValues(0, 1, 0), this.rot),
        vec3.fromValues(this.pos[0], 0, this.pos[1]),
        vec3.fromValues(this.scl, this.scl, this.scl),
      );
      mat3.normalFromMat4(this.normalMat, this.mat);
      this.matrixDirty = false;
    }
  }
}
