import { vec3 } from 'gl-matrix';

/**
 * Sphere used for culling
 */
export class CullSphere {
  /**
   * Sphere center
   */
  public center: vec3;

  /**
   * Sphere radius
   */
  public radius: number;

  /**
   * Create sphere from center and radius
   * @param center
   * @param radius
   */
  public constructor(center: vec3, radius: number) {
    this.center = vec3.clone(center);
    this.radius = radius;
  }

  /**
   * Create sphere from point cloud
   * @param vertexData
   * @param stride
   */
  public static fromPointCloud(vertexData: number[] | Float32Array, stride: number = 0) {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    // Build AABB box
    for (let i = 0; i < vertexData.length; i += stride + 3) {
      minX = Math.min(minX, vertexData[i]);
      minY = Math.min(minY, vertexData[i + 1]);
      minZ = Math.min(minZ, vertexData[i + 2]);
      maxX = Math.max(maxX, vertexData[i]);
      maxY = Math.max(maxY, vertexData[i + 1]);
      maxZ = Math.max(maxZ, vertexData[i + 2]);
    }

    // Calculate box center and radius
    const cx = minX + (maxX - minX) / 2;
    const cy = minY + (maxY - minY) / 2;
    const cz = minZ + (maxZ - minZ) / 2;
    const radius = Math.hypot(maxX - cx, maxY - cy, maxZ - cz);

    return new CullSphere(vec3.fromValues(cx, cy, cz), radius);
  }
}
