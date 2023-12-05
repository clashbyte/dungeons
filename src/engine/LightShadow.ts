import { mat4, vec3 } from 'gl-matrix';
import { GL } from '../core/GL.ts';
import { Shader } from './Shader.ts';

export const SHADOW_SIZE = 256;

const CUBE_LOOK_DIR = [
  vec3.fromValues(1.0, 0.0, 0.0),
  vec3.fromValues(-1.0, 0.0, 0.0),
  vec3.fromValues(0.0, 0.0, 1.0),
  vec3.fromValues(0.0, 0.0, -1.0),
  vec3.fromValues(0.0, 1.0, 0.0),
  vec3.fromValues(0.0, -1.0, 0.0),
];

const CUBE_LOOK_UP = [
  vec3.fromValues(0.0, 1.0, 0.0),
  vec3.fromValues(0.0, 1.0, 0.0),
  vec3.fromValues(0.0, 1.0, 0.0),
  vec3.fromValues(0.0, 1.0, 0.0),
  vec3.fromValues(0.0, 0.0, 1.0),
  vec3.fromValues(0.0, 0.0, -1.0),
];

const CUBE_OFFSET: [number, number][] = [
  [2, 1],
  [0, 1],
  [3, 1],
  [1, 1],
  [3, 0],
  [1, 0],
];

/**
 * Internal class for light shadow buffer
 */
export class LightShadow {
  /**
   * Empty placeholder for color buffer
   * @private
   */
  private static emptyTexture: WebGLTexture | null = null;

  /**
   * Target framebuffer
   * @private
   */
  private readonly framebuffer: WebGLFramebuffer;

  /**
   * Depth buffer texture
   * @private
   */
  private readonly depthTexture: WebGLTexture;

  /**
   * Light local position
   * @private
   */
  private readonly localPosition: vec3;

  /**
   * Light internal color
   * @private
   */
  private readonly localColor: vec3;

  /**
   * Light internal range
   * @private
   */
  private localRange: number;

  /**
   * Light projection matrix
   * @private
   */
  private readonly projMatrix: mat4;

  /**
   * Six view matrices for each direction
   * @private
   */
  private readonly viewMatrix: mat4[];

  /**
   * Flag for view matrices rebuild
   * @private
   */
  private dirtyView: boolean;

  /**
   * Flag for projection rebuild
   * @private
   */
  private dirtyProj: boolean;

  /**
   * Get light position
   */
  public get position() {
    return vec3.clone(this.localPosition);
  }

  /**
   * Update light position
   * @param value
   */
  public set position(value: vec3) {
    if (!vec3.equals(value, this.localPosition)) {
      vec3.copy(this.localPosition, value);
      this.dirtyView = true;
    }
  }

  /**
   * Get light range
   */
  public get range() {
    return this.localRange;
  }

  /**
   * Update light range
   * @param value
   */
  public set range(value: number) {
    if (this.localRange !== value) {
      this.localRange = value;
      this.dirtyProj = true;
    }
  }

  /**
   * Get light color
   */
  public get color() {
    return vec3.clone(this.localColor);
  }

  /**
   * Update light color
   * @param value
   */
  public set color(value: vec3) {
    vec3.copy(this.localColor, value);
  }

  /**
   * Create light shadow buffer
   * @param position
   * @param range
   * @param color
   */
  public constructor(position: vec3, range: number, color: vec3) {
    this.localPosition = vec3.clone(position);
    this.localRange = range;
    this.localColor = vec3.clone(color);

    this.projMatrix = mat4.create();
    this.viewMatrix = [
      mat4.create(),
      mat4.create(),
      mat4.create(),
      mat4.create(),
      mat4.create(),
      mat4.create(),
    ];

    if (!LightShadow.emptyTexture) {
      const tex = GL.createTexture()!;
      GL.bindTexture(GL.TEXTURE_2D, tex);
      GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
      GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
      GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
      GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
      GL.texStorage2D(GL.TEXTURE_2D, 1, GL.DEPTH_COMPONENT24, SHADOW_SIZE * 4, SHADOW_SIZE * 2);
      GL.bindTexture(GL.TEXTURE_2D, null);
      LightShadow.emptyTexture = tex;
    }

    this.depthTexture = GL.createTexture()!;
    GL.bindTexture(GL.TEXTURE_2D, this.depthTexture);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR);
    GL.texStorage2D(GL.TEXTURE_2D, 1, GL.R16F, SHADOW_SIZE * 4, SHADOW_SIZE * 2);
    GL.bindTexture(GL.TEXTURE_2D, null);

    this.framebuffer = GL.createFramebuffer()!;
    GL.bindFramebuffer(GL.FRAMEBUFFER, this.framebuffer);
    GL.bindTexture(GL.TEXTURE_2D, LightShadow.emptyTexture);
    GL.framebufferTexture2D(
      GL.FRAMEBUFFER,
      GL.COLOR_ATTACHMENT3,
      GL.TEXTURE_2D,
      this.depthTexture,
      0,
    );
    GL.bindTexture(GL.TEXTURE_2D, this.depthTexture);
    GL.framebufferTexture2D(
      GL.FRAMEBUFFER,
      GL.DEPTH_ATTACHMENT,
      GL.TEXTURE_2D,
      LightShadow.emptyTexture,
      0,
    );
    GL.bindTexture(GL.TEXTURE_2D, null);
    GL.drawBuffers([GL.NONE, GL.NONE, GL.NONE, GL.COLOR_ATTACHMENT3]);
    GL.bindFramebuffer(GL.FRAMEBUFFER, null);

    this.dirtyProj = true;
    this.dirtyView = true;
  }

  /**
   * Setup shadow uniforms
   * @param shader
   */
  public setup(shader: Shader) {
    GL.uniform3fv(shader.uniform('uLightPosition'), this.localPosition);
    GL.uniform3fv(shader.uniform('uLightColor'), this.localColor);
    GL.uniform1f(shader.uniform('uLightRange'), this.localRange);
    shader.setTexture('uShadowMap', this.depthTexture);
  }

  /**
   * Setup matrices for specific face pass
   * @param face
   */
  public setupShadowPass(face: number) {
    if (this.dirtyProj) {
      mat4.perspective(this.projMatrix, Math.PI * 0.5, 1, 0.1, this.localRange);
      this.dirtyProj = false;
    }
    if (this.dirtyView) {
      for (let i = 0; i < 6; i++) {
        mat4.lookAt(
          this.viewMatrix[i],
          this.localPosition,
          vec3.add(vec3.create(), this.localPosition, CUBE_LOOK_DIR[i]),
          CUBE_LOOK_UP[i],
        );
      }
      this.dirtyView = false;
    }

    const ox = CUBE_OFFSET[face][0] * SHADOW_SIZE;
    const oy = CUBE_OFFSET[face][1] * SHADOW_SIZE;
    GL.bindFramebuffer(GL.FRAMEBUFFER, this.framebuffer);
    GL.viewport(ox, oy, SHADOW_SIZE, SHADOW_SIZE);
    GL.scissor(ox, oy, SHADOW_SIZE, SHADOW_SIZE);
    GL.clear(GL.DEPTH_BUFFER_BIT);
    Shader.updateCamera(this.viewMatrix[face], this.projMatrix);
  }

  /**
   * Release light resources
   */
  public dispose() {
    // TODO
  }
}
