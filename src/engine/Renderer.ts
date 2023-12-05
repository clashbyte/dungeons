import { mat4, quat, vec3, vec4 } from 'gl-matrix';
import { setDebugText } from '../core/DebugBadge.ts';
import { GL, screenSize } from '../core/GL.ts';
import { buildSphere } from '../helpers/BuildSphere.ts';
import { createIndexBuffer, createVertexBuffer } from '../helpers/GLHelpers.ts';
import { Camera } from './Camera.ts';
import { CullSphere } from './CullSphere.ts';
import { LightShadow, SHADOW_SIZE } from './LightShadow.ts';
import { Shader } from './Shader.ts';

import ComposeFrag from '@/shaders/compose/compose.frag.glsl?raw';
import ComposeVert from '@/shaders/compose/compose.vert.glsl?raw';
import SphereFrag from '@/shaders/compose/light.frag.glsl?raw';
import SphereVert from '@/shaders/compose/light.vert.glsl?raw';
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
   * Active light shadows
   * @private
   */
  private static shadows: LightShadow[];

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

    // Building light pass buffers and sphere mesh
    const sphere = buildSphere();
    this.lightSphereBuffer = createVertexBuffer(new Float32Array(sphere.vertices));
    this.lightSphereIndexBuffer = createIndexBuffer(new Uint16Array(sphere.indices));
    this.lightSphereIndexCount = sphere.indices.length;
    this.lightMapBuffer = GL.createFramebuffer()!;
    this.lightSphereDirectShader = new Shader(SphereFrag, SphereVert);
    this.lightSphereShadowShader = new Shader(
      SphereFrag,
      SphereVert,
      false,
      {},
      {
        SHADOW_MAP: 1,
      },
    );

    // Building outline buffer
    this.outlineBuffer = GL.createFramebuffer()!;
    this.whiteShader = new Shader(WhiteFrag, WhiteVert, false);

    // Pull GL extensions
    GL.getExtension('EXT_color_buffer_float');
    GL.getExtension('WEBGL_depth_texture');
    GL.depthFunc(GL.LEQUAL);

    // Change active shadows quota
    this.shadows = [];
    this.changeShadowQuota(1);
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
    let time = performance.now();
    const start = time;
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
    this.performance.lightSort = performance.now() - time;
    time = performance.now();

    // Shadows pass - compute depth maps
    this.performance.lightRender.length = 0;
    if (shadowLights.length > 0) {
      GL.enable(GL.SCISSOR_TEST);
      for (let i = 0; i < shadowLights.length; i++) {
        time = performance.now();
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

        this.performance.lightRender.push(performance.now() - time);
        time = performance.now();
      }
      GL.disable(GL.SCISSOR_TEST);
    }

    // G-buffer pass
    time = performance.now();
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
    this.performance.direct = performance.now() - time;

    // Lights pass - render point lights
    time = performance.now();
    GL.bindFramebuffer(GL.FRAMEBUFFER, this.lightMapBuffer);
    this.setupViewport();
    GL.clearColor(0.1, 0.1, 0.1, 1.0);
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
        shadow.setup(this.lightSphereShadowShader);
        GL.drawElements(GL.TRIANGLES, this.lightSphereIndexCount, GL.UNSIGNED_SHORT, 0);
        this.lightSphereShadowShader.unbind();
      } else {
        this.lightSphereDirectShader.updateMatrix(mat);

        this.lightSphereDirectShader.bind();
        this.lightSphereDirectShader.setBuffer('position', this.lightSphereBuffer, 3, GL.FLOAT);
        this.lightSphereDirectShader.setTexture('uPosition', this.positionTexture);
        this.lightSphereDirectShader.setTexture('uNormal', this.normalTexture);

        GL.uniform3fv(this.lightSphereDirectShader.uniform('uLightPosition'), light.position);
        GL.uniform3fv(this.lightSphereDirectShader.uniform('uLightColor'), light.color);
        GL.uniform1f(this.lightSphereDirectShader.uniform('uLightRange'), light.range);

        GL.drawElements(GL.TRIANGLES, this.lightSphereIndexCount, GL.UNSIGNED_SHORT, 0);
        this.lightSphereDirectShader.unbind();
      }
    }
    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, null);
    GL.depthMask(true);
    GL.cullFace(GL.BACK);
    GL.disable(GL.BLEND);
    GL.depthFunc(GL.LEQUAL);
    this.performance.lighting = performance.now() - time;

    time = performance.now();
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

    this.performance.outline = performance.now() - time;

    // Composition pass
    time = performance.now();
    GL.bindFramebuffer(GL.FRAMEBUFFER, null);

    this.composeShader.bind();
    this.composeShader.setBuffer('position', this.composeBuffer, 2, GL.FLOAT, false);

    this.composeShader.setTexture('uDiffuse', this.diffuseTexture);
    this.composeShader.setTexture('uLightmap', this.lightMapTexture);
    this.composeShader.setTexture('uPosition', this.positionTexture);
    this.composeShader.setTexture('uNormal', this.normalTexture);
    this.composeShader.setTexture('uOutline', this.outlineTexture);

    GL.uniform3fv(this.composeShader.uniform('uPlayer'), sortCenter);
    GL.uniform2fv(this.composeShader.uniform('uScreenSize'), screenSize);
    if (outlineColor) {
      GL.uniform4fv(this.composeShader.uniform('uOutlineColor'), outlineColor);
    }

    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, this.composeIndexBuffer);
    GL.drawElements(GL.TRIANGLES, 6, GL.UNSIGNED_SHORT, 0);
    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, null);
    this.composeShader.unbind();
    this.performance.compose = performance.now() - time;
    this.performance.total = performance.now() - start;

    setDebugText(
      [
        `Overall: ${this.performance.total.toFixed(1)}ms`, //
        `Sorting: ${this.performance.lightSort.toFixed(1)}ms`, //
        `Lights: ${this.performance.lightRender
          .reduce((prev, current) => prev + current, 0)
          .toFixed(1)}ms`, //

        `G-pass: ${this.performance.direct.toFixed(1)}ms`, //
        `Lights: ${this.performance.lighting.toFixed(1)}ms`, //
        `Outline: ${this.performance.outline.toFixed(1)}ms`, //
        `Compose: ${this.performance.compose.toFixed(1)}ms`, //
      ].join('\n'),
    );
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
