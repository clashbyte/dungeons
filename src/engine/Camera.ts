import { mat3, mat4, quat, vec2, vec3, vec4 } from 'gl-matrix';
import { CullSphere } from './CullSphere.ts';
import { Frustum } from './Frustum.ts';
import { Shader } from './Shader';

const EMPTY_MATRIX = mat4.create();

/**
 * Class for camera handling
 */
export class Camera {
  /**
   * WebGL View matrix
   * @type {mat4}
   * @private
   */
  private static readonly viewMatrix: mat4 = mat4.identity(mat4.create());

  /**
   * View-space normal matrix
   * @private
   */
  private static readonly viewNormalMatrix: mat3 = mat3.identity(mat3.create());

  /**
   * Complete combined matrix
   * @type {mat4}
   * @private
   */
  private static readonly cameraMatrix: mat4 = mat4.identity(mat4.create());

  /**
   * Projection matrix
   * @type {mat4}
   * @private
   */
  private static readonly projMatrix: mat4 = mat4.identity(mat4.create());

  /**
   * UI matrix
   * @private
   */
  private static readonly uiProjMatrix: mat4 = mat4.identity(mat4.create());

  /**
   * Camera position
   * @type {vec3}
   * @private
   */
  private static readonly pos: vec3 = vec3.fromValues(0, 0, 0);

  /**
   * Camera rotation in Euler angles
   * @type {vec3}
   * @private
   */
  private static readonly rot: vec3 = vec3.fromValues(0, 0, 0);

  /**
   * Frustum for culling
   * @private
   */
  private static readonly frustum: Frustum = new Frustum();

  /**
   * Flag that position/rotation changed
   * @type {boolean}
   * @private
   */
  private static matrixDirty: boolean = true;

  public static getViewMatrices() {
    if (this.matrixDirty) {
      this.updateMatrices();
    }
    const normal = mat3.create();
    mat3.normalFromMat4(normal, this.viewMatrix);
    // mat4.multiply(position, this.projMatrix, this.viewMatrix);

    return [this.projMatrix, this.viewMatrix, normal] as const;
  }

  /**
   * Get camera position vector
   * @returns {any}
   */
  public static get position() {
    return vec3.fromValues(this.pos[0], this.pos[1], this.pos[2]);
  }

  /**
   * Update camera position vector
   * @param {vec3} value
   */
  public static set position(value: vec3) {
    if (!vec3.equals(this.pos, value)) {
      vec3.copy(this.pos, value);
      this.matrixDirty = true;
    }
  }

  /**
   * Get camera angles
   * @returns {vec3}
   */
  public static get rotation() {
    return vec3.fromValues(this.rot[0], this.rot[1], this.rot[2]);
  }

  /**
   * Update camera rotation
   * @param {vec3} value
   */
  public static set rotation(value: vec3) {
    if (!vec3.equals(this.rot, value)) {
      vec3.copy(this.rot, value);
      this.matrixDirty = true;
    }
  }

  /**
   * Point camera to specific target
   * @param position
   * @param target
   */
  public static lookAt(position: vec3, target: vec3) {
    const diff = vec3.sub(vec3.create(), target, position);
    const len = Math.hypot(diff[2], diff[0]);
    if (len > 0) {
      const yaw = (Math.atan2(-diff[0], -diff[2]) * 180) / Math.PI;
      const pitch = (Math.atan2(diff[1], len) * 180) / Math.PI;
      this.rotation = [pitch, yaw, 0];
    }
    this.position = position;
  }

  /**
   * Update projection with screen aspect
   * @param {number} aspect
   */
  public static updateProjection(aspect: number) {
    mat4.perspective(this.projMatrix, 0.7, aspect, 0.1, 400);

    const sizeY = 768;
    const sizeX = sizeY * aspect;
    const diffX = (sizeX - 1024) / 2;

    mat4.ortho(this.uiProjMatrix, -diffX, sizeX - diffX, sizeY, 0, -1, 1);
    this.matrixDirty = true;
    this.updateMatrices();
  }

  /**
   * Updating matrix bindings for shaders
   */
  public static bindMatrices() {
    this.updateMatrices();
    Shader.updateCamera(this.viewMatrix, this.projMatrix, this.viewNormalMatrix);
  }

  /**
   * Interface camera
   */
  public static bindUIMatrices() {
    Shader.updateCamera(EMPTY_MATRIX, this.uiProjMatrix, this.viewNormalMatrix);
  }

  /**
   * Ray projection
   * @param position
   */
  public static projectRay(position: vec2) {
    this.updateMatrices();
    const rx = position[0] * 2 - 1;
    const ry = position[1] * -2 + 1;
    const v0 = vec4.fromValues(rx, ry, -1, 1);
    const v1 = vec4.fromValues(rx, ry, 1, 1);

    const proj = mat4.create();
    mat4.multiply(proj, this.projMatrix, this.viewMatrix);
    mat4.invert(proj, proj);

    vec4.transformMat4(v0, v0, proj);
    vec4.transformMat4(v1, v1, proj);

    const src = vec3.fromValues(v0[0] / v0[3], v0[1] / v0[3], v0[2] / v0[3]);
    const dst = vec3.fromValues(v1[0] / v1[3], v1[1] / v1[3], v1[2] / v1[3]);
    vec3.sub(dst, dst, src);
    vec3.normalize(dst, dst);

    return [src, dst] as const;
  }

  /**
   * Project world coords to clip space
   * @param position
   */
  public static projectToClip(position: vec3) {
    this.updateMatrices();

    const proj = mat4.create();
    mat4.multiply(proj, this.projMatrix, this.viewMatrix);

    const out = vec3.clone(position);
    vec3.transformMat4(out, out, proj);

    return out;
  }

  /**
   * Cull sphere
   * @param sphere
   */
  public static sphereVisible(sphere: CullSphere) {
    this.updateMatrices();

    return this.frustum.sphereVisible(sphere);
  }

  /**
   * Cull sphere coords
   */
  public static sphereCoordsVisible(center: vec3, radius: number) {
    this.updateMatrices();

    return this.frustum.sphereCoordsVisible(center, radius);
  }

  /**
   * Recalculate all matrices on changes
   * @private
   */
  private static updateMatrices() {
    if (this.matrixDirty) {
      mat4.fromRotationTranslation(
        this.cameraMatrix,
        quat.fromEuler(quat.create(), this.rot[0], this.rot[1], this.rot[2]),
        this.pos,
      );
      mat4.invert(this.viewMatrix, this.cameraMatrix);
      mat3.normalFromMat4(this.viewNormalMatrix, this.viewMatrix);

      this.frustum.rebuild(this.projMatrix, this.viewMatrix);

      this.matrixDirty = false;
    }
  }
}
