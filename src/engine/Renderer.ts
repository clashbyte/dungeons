import { mat3, mat4, quat, vec3, vec4 } from 'gl-matrix';
import { GL, screenSize } from '../core/GL.ts';
import { buildSphere } from '../helpers/BuildSphere.ts';
import { createIndexBuffer, createVertexBuffer } from '../helpers/GLHelpers.ts';
import { Camera } from './Camera.ts';
import { CullSphere } from './CullSphere.ts';
import { LightShadow, SHADOW_SIZE } from './LightShadow.ts';
import { Shader } from './Shader.ts';

import { lerp } from '@/helpers/MathUtils.ts';
import ComposeFrag from '@/shaders/compose/compose.frag.glsl?raw';
import ComposeVert from '@/shaders/compose/compose.vert.glsl?raw';
import SphereFrag from '@/shaders/compose/light.frag.glsl?raw';
import SphereVert from '@/shaders/compose/light.vert.glsl?raw';
import SSAOFrag from '@/shaders/compose/ssao.frag.glsl';
import SSAOVert from '@/shaders/compose/ssao.vert.glsl';
import WhiteFrag from '@/shaders/compose/white.frag.glsl?raw';
import WhiteVert from '@/shaders/compose/white.vert.glsl?raw';

interface RenderPerformance {
  lightSort: number;
  lightRender: number[];
  direct: number;
  outline: number;
  lighting: number;
  compose: number;
  total: number;
}

export interface PointLight {
  position: vec3;
  range: number;
  color: vec3;
  noShadow?: boolean;
}

export interface RenderTask {
  sphere?: CullSphere;
  disableShadow?: boolean;
  outline?: boolean;
  draw: (shadowPass: boolean) => void;
}

/**
 * Rendering pipeline
 */
export class Renderer {
  /**
   * Max amount of lights with shadows
   * @private
   */
  private static SHADOW_QUOTA = 0;

  /**
   * Size of a SSAO kernel
   * @private
   */
  private static readonly SSAO_KERNEL_SIZE = 16;

  /**
   * Size of a SSAO random texture
   * @private
   */
  private static readonly SSAO_NOISE_SIZE = 16;

  /**
   * G-pass diffuse texture
   * @private
   */
  private static diffuseTexture: WebGLTexture;

  /**
   * G-pass position texture
   * @private
   */
  private static positionTexture: WebGLTexture;

  /**
   * G-pass normal texture
   * @private
   */
  private static normalTexture: WebGLTexture;

  /**
   * Shared depth texture
   * @private
   */
  private static depthTexture: WebGLTexture;

  /**
   * Compose quad vertex buffer (XY-only)
   * @private
   */
  private static composeBuffer: WebGLBuffer;

  /**
   * Compose quad index buffer (two tris)
   * @private
   */
  private static composeIndexBuffer: WebGLBuffer;

  /**
   * G-buffer and light composition shader
   * @private
   */
  private static composeShader: Shader;

  /**
   * G-buffer framebuffer
   * @private
   */
  private static offscreenBuffer: WebGLFramebuffer;

  /**
   * Light pass buffer
   * @private
   */
  private static lightMapBuffer: WebGLFramebuffer;

  /**
   * Stencil-fill buffer
   * @private
   */
  private static outlineBuffer: WebGLFramebuffer;

  /**
   * SSAO buffer
   * @private
   */
  private static ssaoBuffer: WebGLFramebuffer;

  /**
   * Light-pass diffuse texture
   * @private
   */
  private static lightMapTexture: WebGLTexture;

  /**
   * Stencil-fill texture
   * @private
   */
  private static outlineTexture: WebGLTexture;

  /**
   * SSAO noise random texture
   * @private
   */
  private static ssaoNoiseTexture: WebGLTexture;

  /**
   * Screen-space SSAO texture
   * @private
   */
  private static ssaoTexture: WebGLTexture;

  /**
   * Vertex buffer for light sphere (XYZ)
   * @private
   */
  private static lightSphereBuffer: WebGLBuffer;

  /**
   * Light sphere index buffer
   * @private
   */
  private static lightSphereIndexBuffer: WebGLBuffer;

  /**
   * Light sphere index count
   * @private
   */
  private static lightSphereIndexCount: number;

  /**
   * Direct shader for light sphere
   * @private
   */
  private static lightSphereDirectShader: Shader;

  /**
   * Shader for light sphere with shadow map sampling
   * @private
   */
  private static lightSphereShadowShader: Shader;

  /**
   * White-fill shader for stencil pass
   * @private
   */
  private static whiteShader: Shader;

  /**
   * SSAO shader
   * @private
   */
  private static ssaoShader: Shader;

  /**
   * Active light shadows
   * @private
   */
  private static shadows: LightShadow[];

  /**
   * SSAO tangent vectors kernel
   * @private
   */
  private static ssaoKernel: number[];

  /**
   * Renderer time slices for single frame
   * @private
   */
  private static readonly performance: RenderPerformance = {
    lightSort: 0,
    lightRender: [],
    lighting: 0,
    direct: 0,
    outline: 0,
    compose: 0,
    total: 0,
  };

  /**
   * Initialize renderer
   */
  public static init() {
    // Building offscreen target
    this.offscreenBuffer = GL.createFramebuffer()!;
    this.composeBuffer = createVertexBuffer(new Float32Array([-1, 1, 1, 1, -1, -1, 1, -1]));
    this.composeIndexBuffer = createIndexBuffer(new Uint16Array([0, 2, 1, 1, 2, 3]));
    this.composeShader = new Shader(ComposeFrag, ComposeVert);

    this.ssaoKernel = [];
    for (let i = 0; i < this.SSAO_KERNEL_SIZE; i++) {
      const vec = vec3.fromValues(
        Math.random() * 2 - 1, //
        Math.random() * 2 - 1,
        Math.random(),
      );
      vec3.normalize(vec, vec);
      vec3.scale(vec, vec, lerp(0.1, 1, Math.random() ** 2));
      this.ssaoKernel.push(vec[0], vec[1], vec[2]);
    }
    const ssaoNoise: number[] = [];
    for (let i = 0; i < this.SSAO_NOISE_SIZE ** 2; i++) {
      const vec = vec3.fromValues(Math.random() * 2 - 1, Math.random() * 2 - 1, 0);
      vec3.normalize(vec, vec);
      ssaoNoise.push(128 * vec[0] * 127, 128 * vec[1] * 127, 0);
    }
    this.ssaoNoiseTexture = GL.createTexture()!;
    GL.bindTexture(GL.TEXTURE_2D, this.ssaoNoiseTexture);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.REPEAT);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.REPEAT);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
    GL.texImage2D(
      GL.TEXTURE_2D,
      0,
      GL.RGB8,
      this.SSAO_NOISE_SIZE,
      this.SSAO_NOISE_SIZE,
      0,
      GL.RGB,
      GL.UNSIGNED_BYTE,
      new Uint8Array(ssaoNoise),
    );
    GL.bindTexture(GL.TEXTURE_2D, null);

    this.ssaoBuffer = GL.createFramebuffer()!;
    this.ssaoShader = new Shader(SSAOFrag, SSAOVert, {
      defines: {
        KERNEL_SIZE: this.SSAO_KERNEL_SIZE,
      },
    });

    // Building light pass buffers and sphere mesh
    const sphere = buildSphere();
    this.lightSphereBuffer = createVertexBuffer(new Float32Array(sphere.vertices));
    this.lightSphereIndexBuffer = createIndexBuffer(new Uint16Array(sphere.indices));
    this.lightSphereIndexCount = sphere.indices.length;
    this.lightMapBuffer = GL.createFramebuffer()!;
    this.lightSphereDirectShader = new Shader(SphereFrag, SphereVert);
    this.lightSphereShadowShader = new Shader(SphereFrag, SphereVert, {
      defines: {
        SHADOW_MAP: 1,
      },
    });

    // Building outline buffer
    this.outlineBuffer = GL.createFramebuffer()!;
    this.whiteShader = new Shader(WhiteFrag, WhiteVert);

    // Pull GL extensions
    GL.getExtension('EXT_color_buffer_float');
    GL.getExtension('WEBGL_depth_texture');
    GL.depthFunc(GL.LEQUAL);

    // Change active shadows quota
    this.shadows = [];
    this.changeShadowQuota(8);
  }

  /**
   * Resize render frame
   * @param width
   * @param height
   */
  public static resize(width: number, height: number) {
    Camera.updateProjection(width / height);

    // Dispose all active textures
    for (const tex of [
      this.diffuseTexture,
      this.positionTexture,
      this.normalTexture,
      this.depthTexture,
      this.lightMapTexture,
      this.outlineTexture,
      this.ssaoTexture,
    ]) {
      if (tex) {
        GL.deleteTexture(tex);
      }
    }

    // Build G-buffer
    GL.bindFramebuffer(GL.FRAMEBUFFER, this.offscreenBuffer);
    this.diffuseTexture = this.createAttachment(GL.RGBA16F, GL.COLOR_ATTACHMENT0);
    this.positionTexture = this.createAttachment(GL.RGBA16F, GL.COLOR_ATTACHMENT1);
    this.normalTexture = this.createAttachment(GL.RGBA16F, GL.COLOR_ATTACHMENT2);
    this.depthTexture = this.createAttachment(GL.DEPTH24_STENCIL8, GL.DEPTH_STENCIL_ATTACHMENT);
    // this.depthTexture = this.createAttachment(GL.DEPTH_COMPONENT16, GL.DEPTH_ATTACHMENT);
    GL.drawBuffers([
      GL.COLOR_ATTACHMENT0, //
      GL.COLOR_ATTACHMENT1,
      GL.COLOR_ATTACHMENT2,
      GL.NONE,
    ]);

    // Build light buffer
    GL.bindFramebuffer(GL.FRAMEBUFFER, this.lightMapBuffer);
    this.lightMapTexture = this.createAttachment(GL.RGBA8, GL.COLOR_ATTACHMENT0);
    GL.framebufferTexture2D(
      GL.FRAMEBUFFER,
      GL.DEPTH_STENCIL_ATTACHMENT,
      GL.TEXTURE_2D,
      this.depthTexture,
      0,
    );
    GL.drawBuffers([
      GL.COLOR_ATTACHMENT0, //
    ]);

    // Build stencil-pass buffer
    GL.bindFramebuffer(GL.FRAMEBUFFER, this.outlineBuffer);
    this.outlineTexture = this.createAttachment(GL.R8, GL.COLOR_ATTACHMENT0);
    GL.framebufferTexture2D(
      GL.FRAMEBUFFER,
      GL.DEPTH_STENCIL_ATTACHMENT,
      GL.TEXTURE_2D,
      this.depthTexture,
      0,
    );

    // SSAO buffer
    GL.bindFramebuffer(GL.FRAMEBUFFER, this.ssaoBuffer);
    this.ssaoTexture = this.createAttachment(GL.R8, GL.COLOR_ATTACHMENT0);
    GL.framebufferTexture2D(
      GL.FRAMEBUFFER,
      GL.COLOR_ATTACHMENT0,
      GL.TEXTURE_2D,
      this.ssaoTexture,
      0,
    );

    GL.bindFramebuffer(GL.FRAMEBUFFER, null);
  }

  /**
   * Change maximum allowed light shadows
   * @param count
   */
  public static changeShadowQuota(count: number) {
    if (count > this.SHADOW_QUOTA) {
      for (let i = 0; i < count - this.SHADOW_QUOTA; i++) {
        this.shadows.push(new LightShadow([0, 0, 0], 1, [0, 0, 0]));
      }
    } else if (count < this.SHADOW_QUOTA) {
      for (let i = 0; i < count - this.SHADOW_QUOTA; i++) {
        const shadow = this.shadows.pop();
        if (shadow) {
          shadow.dispose();
        }
      }
    }
    this.SHADOW_QUOTA = count;
  }

  /**
   * Update viewport
   * @private
   */
  private static setupViewport() {
    const w = screenSize[0];
    const h = screenSize[1];

    GL.viewport(0, 0, w, h);
    Camera.bindMatrices();
  }

  /**
   * Forward-render scene
   * @param callback
   */
  public static render(callback: () => void) {
    this.setupViewport();

    GL.clearColor(0, 0, 0, 1);

    GL.enable(GL.DEPTH_TEST);
    GL.depthFunc(GL.LEQUAL);
    GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT | GL.STENCIL_BUFFER_BIT);

    GL.enable(GL.CULL_FACE);
    GL.cullFace(GL.BACK);

    callback();
  }

  /**
   * Handle deferred-rendered frame pass
   * @param sortCenter
   * @param tasks
   * @param sceneLights
   * @param outlineColor
   */
  public static renderDeferred(
    sortCenter: vec3,
    tasks: RenderTask[],
    sceneLights: PointLight[],
    outlineColor: vec4 | null,
  ) {
    // Process visible lights
    const [lights, shadowLights] = this.lightShadowPass(tasks, sceneLights, sortCenter);

    // G-buffer pass
    const [projMatrix, viewMatrix, normalMatrix] = Camera.getViewMatrices();
    const invNormalMatrix = mat3.clone(normalMatrix);
    mat3.invert(invNormalMatrix, invNormalMatrix);
    this.deferredGeometryPass(tasks);

    // Lights pass - render point lights
    this.lightPass(lights, shadowLights, viewMatrix, invNormalMatrix);

    this.outlinePass();

    this.SSAOPass(projMatrix);

    this.composePass(sortCenter, outlineColor);
  }

  private static lightShadowPass(tasks: RenderTask[], sceneLights: PointLight[], sortCenter: vec3) {
    const lights = sceneLights
      .filter((l) => Camera.sphereCoordsVisible(l.position, l.range))
      .map((l) => ({
        light: l,
        dist: vec3.sqrDist(sortCenter, l.position),
      }))
      .sort((a, b) => a.dist - b.dist)
      .map((l) => l.light);

    const shadowLights: number[] = [];
    for (let i = 0; i < lights.length; i++) {
      const l = lights[i];
      const need = !l.noShadow && shadowLights.length < this.SHADOW_QUOTA;
      if (need) {
        shadowLights.push(i);
      }
    }

    // Shadows pass - compute depth maps
    if (shadowLights.length > 0) {
      GL.enable(GL.SCISSOR_TEST);
      for (let i = 0; i < shadowLights.length; i++) {
        const shadow = this.shadows[i];
        const light = lights[shadowLights[i]];
        shadow.position = light.position;
        shadow.range = light.range;
        shadow.color = light.color;

        const subTasks = tasks.filter(
          (t) =>
            t.sphere === undefined ||
            vec3.sqrDist(light.position, t.sphere.center) <= (t.sphere.radius + light.range) ** 2,
        );

        if (subTasks.length) {
          // Render all active entities for each face
          for (let face = 0; face < 6; face++) {
            shadow.setupShadowPass(face);
            GL.colorMask(true, true, true, true);
            GL.clearColor(1024, 1, 1, 1);
            GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);
            GL.depthMask(true);
            GL.disable(GL.BLEND);
            GL.enable(GL.DEPTH_TEST);
            GL.depthFunc(GL.LEQUAL);

            for (const t of subTasks) {
              t.draw(true);
            }
          }
        }
      }
      GL.disable(GL.SCISSOR_TEST);
    }

    return [lights, shadowLights] as const;
  }

  private static deferredGeometryPass(tasks: RenderTask[]) {
    GL.bindFramebuffer(GL.FRAMEBUFFER, this.offscreenBuffer);
    this.setupViewport();
    GL.enable(GL.STENCIL_TEST);
    GL.clearStencil(0);
    GL.stencilMask(0xff);
    GL.clearColor(0.0, 0.0, 0.0, 0.0);
    GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT | GL.STENCIL_BUFFER_BIT);
    GL.disable(GL.BLEND);
    GL.enable(GL.DEPTH_TEST);
    GL.enable(GL.CULL_FACE);
    GL.cullFace(GL.BACK);
    GL.stencilFunc(GL.ALWAYS, 1, 0xff);

    for (const task of tasks) {
      let visible = true;
      if (task.sphere) {
        visible = Camera.sphereVisible(task.sphere);
      }
      if (visible) {
        GL.stencilOp(GL.KEEP, GL.KEEP, task.outline ? GL.REPLACE : GL.KEEP);
        task.draw(false);
      }
    }
    GL.disable(GL.STENCIL_TEST);
  }

  private static lightPass(
    lights: PointLight[],
    shadowLights: number[],
    viewMatrix: mat4,
    invNormalMatrix: mat3,
  ) {
    GL.bindFramebuffer(GL.FRAMEBUFFER, this.lightMapBuffer);
    this.setupViewport();
    GL.clearColor(0, 0, 0, 1);
    GL.clear(GL.COLOR_BUFFER_BIT);
    GL.depthMask(false);
    GL.stencilMask(0x00);
    GL.cullFace(GL.FRONT);
    GL.enable(GL.BLEND);
    GL.blendFunc(GL.ONE, GL.ONE);
    GL.depthFunc(GL.GEQUAL);
    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, this.lightSphereIndexBuffer);
    const rot = quat.identity(quat.create());
    for (let i = 0; i < lights.length; i++) {
      const light = lights[i];
      const shadowId = shadowLights.indexOf(i);
      const pos = vec3.clone(light.position);
      vec3.transformMat4(pos, pos, viewMatrix);

      const mat = mat4.fromRotationTranslationScale(mat4.create(), rot, light.position, [
        light.range,
        light.range,
        light.range,
      ]);

      if (shadowId !== -1) {
        const shadow = this.shadows[shadowId];

        this.lightSphereShadowShader.updateMatrix(mat);

        this.lightSphereShadowShader.bind();
        this.lightSphereShadowShader.setBuffer('position', this.lightSphereBuffer, 3, GL.FLOAT);
        this.lightSphereShadowShader.setTexture('uPosition', this.positionTexture);
        this.lightSphereShadowShader.setTexture('uNormal', this.normalTexture);
        GL.uniformMatrix3fv(
          this.lightSphereShadowShader.uniform('uInverseNormalMat'),
          false,
          invNormalMatrix,
        );
        // this.lightSphereShadowShader.setUniforms('uInverseNormalMat', this.normalTexture);
        shadow.setup(this.lightSphereShadowShader, pos);
        GL.drawElements(GL.TRIANGLES, this.lightSphereIndexCount, GL.UNSIGNED_SHORT, 0);
        this.lightSphereShadowShader.unbind();
      } else {
        this.lightSphereDirectShader.updateMatrix(mat);

        this.lightSphereDirectShader.bind();
        this.lightSphereDirectShader.setUniforms({
          uLightPosition: pos,
          uLightColor: light.color,
          uLightRange: light.range,
          uPosition: this.positionTexture,
          uNormal: this.normalTexture,
        });
        this.lightSphereDirectShader.setBuffer('position', this.lightSphereBuffer, 3, GL.FLOAT);
        GL.drawElements(GL.TRIANGLES, this.lightSphereIndexCount, GL.UNSIGNED_SHORT, 0);
        this.lightSphereDirectShader.unbind();
      }
    }
    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, null);
    GL.depthMask(true);
    GL.cullFace(GL.BACK);
    GL.disable(GL.BLEND);
    GL.depthFunc(GL.LEQUAL);
  }

  private static outlinePass() {
    GL.bindFramebuffer(GL.FRAMEBUFFER, this.outlineBuffer);
    GL.enable(GL.STENCIL_TEST);
    GL.clearColor(0, 0, 0, 1);
    GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);
    GL.stencilFunc(GL.EQUAL, 1, 0xff);
    GL.stencilOp(GL.KEEP, GL.KEEP, GL.KEEP);
    this.whiteShader.bind();
    this.composeShader.setBuffer('position', this.composeBuffer, 2, GL.FLOAT, false);
    this.composeShader.draw(this.composeIndexBuffer, 6);
    this.whiteShader.unbind();
    GL.disable(GL.STENCIL_TEST);
    GL.disable(GL.DEPTH_TEST);
  }

  private static SSAOPass(projMatrix: mat4) {
    GL.bindFramebuffer(GL.FRAMEBUFFER, this.ssaoBuffer);
    GL.clearColor(1, 1, 1, 1);
    GL.clear(GL.COLOR_BUFFER_BIT);
    this.ssaoShader.bind();
    this.ssaoShader.setBuffer('position', this.composeBuffer, 2, GL.FLOAT, false);
    this.ssaoShader.setTexture('uPosition', this.positionTexture);
    this.ssaoShader.setTexture('uNormal', this.normalTexture);
    this.ssaoShader.setTexture('uNoise', this.ssaoNoiseTexture);
    // this.ssaoShader.setTexture('uDepth', this.depthTexture);
    GL.uniformMatrix4fv(this.ssaoShader.uniform('uProjMat'), false, projMatrix);
    GL.uniform3fv(this.ssaoShader.uniform('uKernel[0]'), new Float32Array(this.ssaoKernel));
    GL.uniform2f(
      this.ssaoShader.uniform('uNoiseScale'),
      screenSize[0] / this.SSAO_NOISE_SIZE,
      screenSize[1] / this.SSAO_NOISE_SIZE,
    );
    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, this.composeIndexBuffer);
    GL.drawElements(GL.TRIANGLES, 6, GL.UNSIGNED_SHORT, 0);
    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, null);
    this.ssaoShader.unbind();
  }

  private static composePass(sortCenter: vec3, outlineColor: vec4 | null) {
    GL.bindFramebuffer(GL.FRAMEBUFFER, null);

    this.composeShader.bind();
    this.composeShader.setBuffer('position', this.composeBuffer, 2, GL.FLOAT, false);
    this.composeShader.setTexture('uDiffuse', this.diffuseTexture);
    this.composeShader.setTexture('uLightmap', this.lightMapTexture);
    this.composeShader.setTexture('uPosition', this.positionTexture);
    this.composeShader.setTexture('uNormal', this.normalTexture);
    this.composeShader.setTexture('uOutline', this.outlineTexture);
    this.composeShader.setTexture('uSSAO', this.ssaoTexture);

    GL.uniform3fv(this.composeShader.uniform('uPlayer'), sortCenter);
    GL.uniform3f(this.composeShader.uniform('uAmbient'), 0.4, 0.4, 0.5);
    GL.uniform2fv(this.composeShader.uniform('uScreenSize'), screenSize);
    if (outlineColor) {
      GL.uniform4fv(this.composeShader.uniform('uOutlineColor'), outlineColor);
    }

    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, this.composeIndexBuffer);
    GL.drawElements(GL.TRIANGLES, 6, GL.UNSIGNED_SHORT, 0);
    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, null);
    this.composeShader.unbind();
  }

  /**
   * Make attachment for framebuffer
   * @param type
   * @param attachment
   * @param shadow
   * @private
   */
  private static createAttachment(type: GLenum, attachment: GLenum, shadow: boolean = false) {
    const w = shadow ? SHADOW_SIZE : screenSize[0];
    const h = shadow ? SHADOW_SIZE : screenSize[1];

    const tex = GL.createTexture()!;
    GL.bindTexture(GL.TEXTURE_2D, tex);
    GL.pixelStorei(GL.UNPACK_FLIP_Y_WEBGL, false);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
    GL.texStorage2D(GL.TEXTURE_2D, 1, type, w, h);
    GL.framebufferTexture2D(GL.FRAMEBUFFER, attachment, GL.TEXTURE_2D, tex, 0);
    GL.bindTexture(GL.TEXTURE_2D, null);

    return tex;
  }
}
