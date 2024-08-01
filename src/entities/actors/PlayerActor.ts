import { Actor } from './Actor.ts';
import { GL } from '@/core/GL.ts';
import { RenderTask } from '@/engine/Renderer.ts';
import { Shader } from '@/engine/Shader.ts';
import { SkinAnimator } from '@/engine/SkinAnimator.ts';
import { Skin, SkinManager } from '@/managers/SkinManager.ts';
import ActorFrag from '@/shaders/test/actor.frag.glsl?raw';
import ActorVert from '@/shaders/test/actor.vert.glsl?raw';

/**
 * Test player actor
 */
export class PlayerActor extends Actor {
  /**
   * Player mesh shader
   * @private
   */
  private static shader: Shader;

  /**
   * Base actor's skin
   * @private
   */
  private readonly skin: Skin;

  /**
   * Skin animator
   * @private
   */
  private readonly animator: SkinAnimator;

  /**
   * Flag for running
   * @private
   */
  private running: boolean;

  /**
   * Create player actor
   */
  public constructor() {
    super();
    if (!PlayerActor.shader) {
      PlayerActor.shader = new Shader(ActorFrag, ActorVert, {
        deferred: true,
      });
    }
    this.skin = SkinManager.getSkin('MalePlayer');
    this.animator = new SkinAnimator(this.skin);
    this.animator.play('HumanIdle', 1);
    this.running = false;

    this.scale = 0.5;
    this.render = this.render.bind(this);
  }

  /**
   * Update player logic
   * @param delta
   */
  public update(delta: number) {
    // this.rotation += 0.1 * delta;
    this.animator.update(delta);
  }

  /**
   * Get player render tasks
   */
  public getRenderTask(): RenderTask[] {
    return [{ sphere: this.cullSphere, draw: this.render }];
  }

  /**
   * Update animations
   * @param run
   */
  public setRunning(run: boolean) {
    if (this.running !== run) {
      this.running = run;
      this.animator.play(run ? 'HumanRun' : 'HumanIdle', 1, 0.2);
    }
  }

  /**
   * Render player mesh
   * @private
   */
  private render() {
    const shader = PlayerActor.shader;
    const diffuse = SkinManager.getTexture('MalePlayerDiffuse');

    shader.updateMatrix(this.matrix);

    for (const surf of Object.values(this.skin.surfaces)) {
      shader.bind();
      shader.setBuffer('position', surf.vertices, 3, GL.FLOAT, false, 32, 0);
      shader.setBuffer('normal', surf.vertices, 3, GL.FLOAT, false, 32, 3 * 4);
      shader.setBuffer('uv', surf.vertices, 2, GL.FLOAT, false, 32, 6 * 4);
      shader.setBuffer('joints', surf.joints!, 4, GL.UNSIGNED_BYTE, false, 0, 0, true);
      shader.setBuffer('weights', surf.weights!, 4, GL.FLOAT, false);
      if (diffuse && diffuse.texture) {
        shader.setTexture('uDiffuse', diffuse.texture);
      }
      shader.setTexture('uSkinMatrices', this.animator.texture);

      GL.uniformMatrix3fv(shader.uniform('normalMat'), false, this.normalMatrix);
      GL.uniform1f(shader.uniform('uBoneCount'), this.animator.boneCount);

      shader.draw(surf.indices, surf.indexCount);
      shader.unbind();
    }
  }
}
