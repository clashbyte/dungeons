import { mat3, mat4, quat, vec2, vec3 } from 'gl-matrix';
import { CullSphere } from '../../engine/CullSphere.ts';
import { RenderTask } from '../../engine/Renderer.ts';

/**
 * Object that player can activate
 */
export abstract class LevelObject {
  /**
   * Position
   * @private
   */
  private readonly localPosition: vec2 = vec2.create();

  /**
   * Angle
   * @private
   */
  private localRotation: number = 0;

  /**
   * Scale
   * @private
   */
  private localScale: number = 1;

  /**
   * Elevation
   * @private
   */
  private localHeight: number = 0;

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
    return vec2.clone(this.localPosition);
  }

  /**
   * Update object position
   * @param pos
   */
  public set position(pos: vec2) {
    if (!vec2.equals(pos, this.localPosition)) {
      vec2.copy(this.localPosition, pos);
      this.matrixDirty = true;
    }
  }

  /**
   * Get object rotation
   */
  public get rotation() {
    return this.localRotation;
  }

  /**
   * Update object rotation
   * @param rot
   */
  public set rotation(rot: number) {
    if (rot !== this.localRotation) {
      this.localRotation = rot;
      this.matrixDirty = true;
    }
  }

  /**
   * Get object elevation
   */
  public get height() {
    return this.localHeight;
  }

  /**
   * Update object elevation
   * @param value
   */
  public set height(value: number) {
    if (value !== this.localHeight) {
      this.localHeight = value;
      this.matrixDirty = true;
    }
  }

  /**
   * Get object scale
   */
  public get scale() {
    return this.localScale;
  }

  /**
   * Update object scale
   * @param scl
   */
  public set scale(scl: number) {
    if (scl !== this.scale) {
      this.localScale = scl;
      this.matrixDirty = true;
    }
  }

  /**
   * Culling sphere
   */
  public get cullSphere() {
    vec3.set(
      this.sphere.center,
      this.localPosition[0],
      this.sphere.radius + this.localHeight,
      this.localPosition[1],
    );

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
  public update(delta: number) {}

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
        quat.setAxisAngle(quat.create(), vec3.fromValues(0, 1, 0), this.localRotation),
        vec3.fromValues(this.localPosition[0], this.localHeight, this.localPosition[1]),
        vec3.fromValues(this.localScale, this.localScale, this.localScale),
      );
      mat3.normalFromMat4(this.normalMat, this.mat);
      this.matrixDirty = false;
    }
  }
}
