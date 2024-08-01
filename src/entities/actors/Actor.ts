import { mat3, mat4, quat, vec2, vec3 } from 'gl-matrix';
import { CullSphere } from '@/engine/CullSphere.ts';
import { RenderTask } from '@/engine/Renderer.ts';
import { clamp, euclideanModulo } from '@/helpers/MathUtils.ts';

/**
 * Base actor class
 */
export abstract class Actor {
  /**
   * Position (XZ-oriented)
   * @private
   */
  private readonly pos: vec2 = vec2.create();

  /**
   * Internal angle
   * @private
   */
  private rot: number = 0;

  /**
   * Internal scale
   * @private
   */
  private scl: number = 1;

  /**
   * Flag for matrix rebuild
   * @private
   */
  private matrixDirty: boolean = true;

  /**
   * Internal object matrix
   * @private
   */
  private readonly mat: mat4 = mat4.create();

  /**
   * Internal normal matrix
   * @private
   */
  private readonly normalMat: mat3 = mat3.create();

  /**
   * Culling sphere
   * @protected
   */
  protected readonly sphere = new CullSphere(vec3.create(), 1);

  /**
   * Get position
   */
  public get position() {
    return vec2.clone(this.pos);
  }

  /**
   * Update position
   * @param pos
   */
  public set position(pos: vec2) {
    if (!vec2.equals(pos, this.pos)) {
      vec2.copy(this.pos, pos);
      this.matrixDirty = true;
    }
  }

  /**
   * Get rotation
   */
  public get rotation() {
    return this.rot;
  }

  /**
   * Update rotation
   * @param rot
   */
  public set rotation(rot: number) {
    if (rot !== this.rot) {
      this.rot = rot;
      this.matrixDirty = true;
    }
  }

  /**
   * Get scale
   */
  public get scale() {
    return this.scl;
  }

  /**
   * Update scale
   * @param scl
   */
  public set scale(scl: number) {
    if (scl !== this.scale) {
      this.scl = scl;
      this.matrixDirty = true;
    }
  }

  /**
   * Get actor culling sphere
   */
  public get cullSphere() {
    vec3.set(this.sphere.center, this.pos[0], this.sphere.radius, this.pos[1]);

    return this.sphere;
  }

  /**
   * Get world-space matrix
   */
  public get matrix() {
    this.rebuildMatrix();

    return this.mat;
  }

  /**
   * Get world-space normal matrix
   * @protected
   */
  protected get normalMatrix() {
    this.rebuildMatrix();

    return this.normalMat;
  }

  /**
   * Rotate actor to specified angle
   * @param angle
   * @param delta
   * @param speed
   */
  public faceAngle(angle: number, delta: number, speed: number = 0.1) {
    let sub = euclideanModulo(angle - this.rot, Math.PI * 2);
    if (sub > Math.PI) {
      sub -= Math.PI * 2;
    }
    sub = clamp(sub, -speed * delta, speed * delta);

    this.rotation += sub;
  }

  /**
   * Update actor logic
   * @param delta
   */
  public abstract update(delta: number): void;

  /**
   * Get actor render tasks
   */
  public abstract getRenderTask(): RenderTask[];

  /**
   * Rebuild actor matrix
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
