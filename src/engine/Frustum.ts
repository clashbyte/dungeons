import { mat4, vec3, vec4 } from 'gl-matrix';
import { CullSphere } from './CullSphere.ts';

/**
 * Camera frustum used for culling
 */
export class Frustum {
  private readonly planes: vec4[] = [];

  /**
   * Create empty frustum
   */
  public constructor() {
    for (let i = 0; i < 6; i++) {
      this.planes[i] = vec4.create();
    }
  }

  /**
   * Rebuild planes from projection
   * @param projMat
   * @param cameraMat
   */
  public rebuild(projMat: mat4, cameraMat: mat4) {
    // Multiplicate projection and direct camera matrix
    const mat = mat4.create();
    mat4.multiply(mat, projMat, cameraMat);
    mat4.transpose(mat, mat);

    // Extract planes from resulting matrix
    const planes = this.extractPlanes(mat);
    for (let i = 0; i < 6; i++) {
      vec4.set(this.planes[i], planes[i][0], planes[i][1], planes[i][2], planes[i][3]);
      vec4.scale(
        this.planes[i],
        this.planes[i],
        1 / Math.hypot(planes[i][0], planes[i][1], planes[i][2]),
      );
    }
  }

  /**
   * Check for sphere visibility
   */
  public sphereCoordsVisible(center: vec3, radius: number) {
    const [cx, cy, cz] = center;
    for (let i = 0; i < 6; i++) {
      const p = this.planes[i];
      if (cx * p[0] + cy * p[1] + cz * p[2] + p[3] <= -radius) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check for sphere visibility
   */
  public sphereVisible(cullSphere: CullSphere) {
    return this.sphereCoordsVisible(cullSphere.center, cullSphere.radius);
  }

  /**
   * Extract planes from matrix
   * @param m
   * @param z
   * @param zf
   * @private
   */
  private extractPlanes(m: mat4, z: number = 0, zf: number = 1) {
    // https://github.com/mikolalysenko/extract-frustum-planes/blob/master/extract-planes.js
    return [
      [m[12] + m[0], m[13] + m[1], m[14] + m[2], m[15] + m[3]],
      [m[12] - m[0], m[13] - m[1], m[14] - m[2], m[15] - m[3]],
      [m[12] + m[4], m[13] + m[5], m[14] + m[6], m[15] + m[7]],
      [m[12] - m[4], m[13] - m[5], m[14] - m[6], m[15] - m[7]],
      [z * m[12] + m[8], z * m[13] + m[9], z * m[14] + m[10], z * m[15] + m[11]],
      [zf * m[12] - m[8], zf * m[13] - m[9], zf * m[14] - m[10], zf * m[15] - m[11]],
    ];
  }
}
