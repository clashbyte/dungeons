import { mat4, quat, vec3 } from 'gl-matrix';
import { GL } from '../core/GL.ts';
import { euclideanModulo } from '../helpers/MathUtils.ts';
import { Skin, SkinAnimation, SkinAnimationFrame, SkinManager } from '../managers/SkinManager.ts';

interface NodeState {
  position: vec3;
  rotation: quat;
  scale: vec3;
}

/**
 * Class for skin animation
 */
export class SkinAnimator {
  /**
   * Base skin mesh
   * @private
   */
  private readonly skin: Skin;

  /**
   * Direct matrices for each bone
   * @private
   */
  private readonly matrices: mat4[];

  /**
   * Skinning matrices (multiplied by bone inverse matrix)
   * @private
   */
  private readonly skinMatrices: mat4[];

  /**
   * Active node state
   * @private
   */
  private readonly state: NodeState[];

  /**
   * Previous state for cross-fade
   * @private
   */
  private readonly transitionState: NodeState[];

  /**
   * Active animation track
   * @private
   */
  private animation: SkinAnimation | null;

  /**
   * Current time
   * @private
   */
  private time: number;

  /**
   * Playback speed
   * @private
   */
  private speed: number;

  /**
   * Internal skin matrices texture
   * @private
   */
  private readonly matrixTexture: WebGLTexture;

  /**
   * Flattened skin matrices
   * @private
   */
  private readonly flatMatrices: Float32Array;

  /**
   * Cross-fade timer
   * @private
   */
  private transitionTime: number;

  /**
   * Cross-fade length
   * @private
   */
  private transitionLength: number;

  /**
   * Create skin animator
   * @param skin
   */
  public constructor(skin: Skin) {
    this.skin = skin;
    this.animation = null;
    this.time = 0;
    this.speed = 0;
    this.flatMatrices = new Float32Array(skin.nodes.length * 16);
    this.transitionTime = 0;
    this.transitionLength = 0;

    this.state = skin.nodes.map((n) => ({
      position: vec3.clone(n.position),
      rotation: quat.clone(n.rotation),
      scale: vec3.clone(n.scale),
    }));
    this.transitionState = this.state.map((s) => ({
      position: vec3.clone(s.position),
      rotation: quat.clone(s.rotation),
      scale: vec3.clone(s.scale),
    }));

    this.matrices = skin.nodes.map((n) => mat4.clone(n.matrix));
    this.skinMatrices = this.matrices.map((mat, idx) => {
      const node = skin.nodes[idx];
      const m = mat4.create();

      return mat4.multiply(m, mat, node.invMatrix);
    });

    this.matrixTexture = GL.createTexture()!;
    GL.bindTexture(GL.TEXTURE_2D, this.matrixTexture);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
    GL.bindTexture(GL.TEXTURE_2D, null);
  }

  /**
   * Get skinning texture
   */
  public get texture() {
    // this.updateSkinTexture();

    return this.matrixTexture;
  }

  /**
   * Get bone count
   */
  public get boneCount() {
    return this.state.length;
  }

  /**
   * Update skinning logic
   * @param delta
   */
  public update(delta: number) {
    const elapsed = 0.0166 * delta;
    if (this.transitionLength > 0) {
      this.transitionTime = Math.max(this.transitionTime - elapsed, 0);
      if (this.transitionTime === 0) {
        this.transitionLength = 0;
      }
    }
    if (this.animation) {
      this.time = euclideanModulo(this.time + elapsed * this.speed, this.animation.length);
    }
    this.updateState();
    this.updateSkinTexture();
  }

  /**
   * Play specific animation track
   * @param animation
   * @param speed
   * @param transition
   */
  public play(animation: string, speed: number = 1, transition: number = 0) {
    if (transition) {
      this.transitionTime = transition;
      this.transitionLength = transition;
      for (let i = 0; i < this.state.length; i++) {
        vec3.copy(this.transitionState[i].position, this.state[i].position);
        quat.copy(this.transitionState[i].rotation, this.state[i].rotation);
        vec3.copy(this.transitionState[i].scale, this.state[i].scale);
      }
    } else {
      this.transitionLength = 0;
      this.transitionTime = 0;
    }
    this.animation = SkinManager.getAnimation(animation);
    this.speed = speed;
    this.time = 0;
  }

  /**
   * Update bones state
   * @private
   */
  private updateState() {
    const position = vec3.create();
    const rotation = quat.create();
    const scale = vec3.create();
    const needTransition = this.transitionTime > 0 && this.transitionLength > 0;
    const transition = needTransition ? this.transitionTime / this.transitionLength : 0;

    for (let i = 0; i < this.state.length; i++) {
      vec3.copy(position, this.skin.nodes[i].position);
      quat.copy(rotation, this.skin.nodes[i].rotation);
      vec3.copy(scale, this.skin.nodes[i].scale);

      if (this.animation) {
        const track = this.animation.nodes[this.skin.nodes[i].name];
        if (track) {
          const [pos1, pos2, posAlpha] = this.findFrame(track, this.time, 'position');
          if (pos1) {
            vec3.copy(position, pos1.position!);
            if (pos2) {
              vec3.lerp(position, position, pos2.position!, posAlpha);
            }
          }

          const [rot1, rot2, rotAlpha] = this.findFrame(track, this.time, 'rotation');
          if (rot1) {
            quat.copy(rotation, rot1.rotation!);
            if (rot2) {
              quat.slerp(rotation, rotation, rot2.rotation!, rotAlpha);
            }
          }

          const [scl1, scl2, sclAlpha] = this.findFrame(track, this.time, 'scale');
          if (scl1) {
            vec3.copy(scale, scl1.scale!);
            if (scl2) {
              vec3.lerp(scale, scale, scl2.scale!, sclAlpha);
            }
          }
        }
      }

      if (needTransition) {
        vec3.lerp(position, position, this.transitionState[i].position, transition);
        quat.slerp(rotation, rotation, this.transitionState[i].rotation, transition);
        vec3.lerp(scale, scale, this.transitionState[i].scale, transition);
      }

      vec3.copy(this.state[i].position, position);
      quat.copy(this.state[i].rotation, rotation);
      vec3.copy(this.state[i].scale, scale);
    }
  }

  /**
   * Rebuild matrices from bone state
   * @private
   */
  private updateMatrices() {
    const tasks = this.skin.nodes
      .map((n, idx) => [idx, n] as const)
      .filter((g) => g[1].parent === null);
    while (tasks.length > 0) {
      const [idx, node] = tasks.shift()!;

      mat4.fromRotationTranslationScale(
        this.matrices[idx],
        this.state[idx].rotation,
        this.state[idx].position,
        this.state[idx].scale,
      );
      if (node.parent) {
        const pidx = this.skin.nodes.indexOf(node.parent);
        mat4.multiply(this.matrices[idx], this.matrices[pidx], this.matrices[idx]);
      }
      if (node.children.length) {
        tasks.push(...node.children.map((n) => [this.skin.nodes.indexOf(n), n] as const));
      }
    }
  }

  /**
   * Upload bone skin matrices to texture
   * @private
   */
  private updateSkinTexture() {
    this.updateMatrices();
    for (let i = 0; i < this.skinMatrices.length; i++) {
      mat4.multiply(this.skinMatrices[i], this.matrices[i], this.skin.nodes[i].invMatrix);
      for (let j = 0; j < 16; j++) {
        this.flatMatrices[i * 16 + j] = this.skinMatrices[i][j];
      }
    }
    GL.bindTexture(GL.TEXTURE_2D, this.matrixTexture);
    GL.texImage2D(
      GL.TEXTURE_2D,
      0,
      GL.RGBA32F,
      4,
      this.matrices.length,
      0,
      GL.RGBA,
      GL.FLOAT,
      this.flatMatrices,
    );
    GL.bindTexture(GL.TEXTURE_2D, null);
  }

  /**
   * Search for a frame with specified transformation
   * @param frames
   * @param time
   * @param field
   * @private
   */
  private findFrame(
    frames: SkinAnimationFrame[],
    time: number,
    field: 'position' | 'rotation' | 'scale',
  ): readonly [SkinAnimationFrame | null, SkinAnimationFrame | null, number] {
    let first: SkinAnimationFrame | null = null;
    let second: SkinAnimationFrame | null = null;
    let alpha = 0;

    for (let i = frames.length - 1; i >= 0; i--) {
      const f = frames[i];
      if (f[field] !== undefined && f.time <= time) {
        first = f;
        for (let j = 1; j <= frames.length; j++) {
          const ii = euclideanModulo(j + i, frames.length);
          const sf = frames[ii];
          if (sf[field] !== undefined) {
            second = sf;
            break;
          }
        }
        break;
      }
    }

    if (first && second) {
      const min = Math.min(first.time, second.time);
      const span = Math.abs(second.time - first.time);
      alpha = (time - min) / span;
      if (second.time < first.time) {
        alpha = 1.0 - alpha;
      }
    }

    return [first, second, alpha] as const;
  }
}
