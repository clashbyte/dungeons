import { mat4 } from 'gl-matrix';
import { GL } from '../core/GL';
import FragmentBase from '../shaders/common/prefix.frag.glsl?raw';
import VertexBase from '../shaders/common/prefix.vert.glsl?raw';

type Lookup<T> = { [key: string]: T | null };
// type UniformValue = number | vec2 | vec3 | vec4 | mat3 | mat4 | WebGLTexture | null;
// type UniformCollection = { [key: string]: UniformValue | UniformValue[] | UniformCollection };

type DefineList = { [key: string]: string | number };

/**
 * WebGL shader wrapper
 */
export class Shader {
  /**
   * Active view matrix
   * @type {mat4}
   * @private
   */
  private static viewMatrix: mat4 = mat4.identity(mat4.create());

  /**
   * Active projection matrix
   * @type {mat4}
   * @private
   */
  private static projMatrix: mat4 = mat4.identity(mat4.create());

  /**
   * Raw vertex shader code
   * @type {string}
   * @private
   */
  private readonly vertexCode: string;

  /**
   * Raw fragment shader code
   * @type {string}
   * @private
   */
  private readonly fragmentCode: string;

  /**
   * WebGL vertex shader
   * @type {WebGLShader | null}
   * @private
   */
  private readonly vertexShader: WebGLShader | null;

  /**
   * WebGL fragment shader
   * @type {WebGLShader | null}
   * @private
   */
  private readonly fragmentShader: WebGLShader | null;

  /**
   * WebGL shader program
   * @type {WebGLProgram | null}
   * @private
   */
  private readonly program: WebGLProgram | null;

  /**
   * Uniform locations lookup
   * @type {Lookup<WebGLUniformLocation>}
   * @private
   */
  private readonly uniforms: {
    location: WebGLUniformLocation;
    name: string;
    type: GLenum;
    size: number;
  }[] = [];

  /**
   * Vertex attribute locations lookup
   * @type {Lookup<number>}
   * @private
   */
  private readonly attributes: Lookup<number>;

  /**
   * User-assigned attribute indices
   * @private
   */
  private readonly forceAttributes: { [name: string]: number };

  /**
   * Current model matrix
   * @type {mat4}
   * @private
   */
  private modelMatrix: mat4;

  /**
   * Bound textures
   * @private
   */
  private readonly textureQuota: { texture: WebGLTexture; target: GLenum }[] = [];

  /**
   * Active bound attributes
   * @private
   */
  private readonly boundAttributes: number[] = [];

  /**
   * Active index buffer
   * @private
   */
  private indexBuffer: WebGLBuffer | null = null;

  /**
   * Update view and projection matrices
   * @param {mat4} viewMatrix
   * @param {mat4} projMatrix
   */
  public static updateCamera(viewMatrix: mat4, projMatrix: mat4) {
    this.viewMatrix = viewMatrix;
    this.projMatrix = projMatrix;
  }

  /**
   * Shader constructor
   * @param {string} fragCode
   * @param {string} vertCode
   * @param offscreen
   */
  public constructor(
    fragCode: string,
    vertCode: string,
    offscreen: boolean = false,
    attribIndices: { [name: string]: number } = {},
    defines: DefineList = {},
  ) {
    this.fragmentCode = fragCode;
    this.vertexCode = vertCode;
    this.modelMatrix = mat4.identity(mat4.create());
    this.uniforms = [];
    this.attributes = {};
    this.vertexShader = null;
    this.fragmentShader = null;
    this.program = null;
    this.forceAttributes = attribIndices;

    try {
      this.vertexShader = this.createShader(this.prefixVertexCode(defines), GL.VERTEX_SHADER);
      this.fragmentShader = this.createShader(
        this.prefixFragmentCode(offscreen, defines),
        GL.FRAGMENT_SHADER,
      );
      this.program = this.createProgram();
      GL.useProgram(this.program);

      // Seeking uniforms
      const uniformCount = GL.getProgramParameter(this.program, GL.ACTIVE_UNIFORMS);
      for (let i = 0; i < uniformCount; i++) {
        const info = GL.getActiveUniform(this.program, i);
        if (info) {
          this.uniforms.push({
            name: info.name,
            size: info.size,
            type: info.type,
            location: GL.getUniformLocation(this.program, info.name)!,
          });
        }
      }

      // Seeking attributes
      const attribCount = GL.getProgramParameter(this.program, GL.ACTIVE_ATTRIBUTES);
      for (let i = 0; i < attribCount; i++) {
        const info = GL.getActiveAttrib(this.program, i);
        if (info) {
          this.attributes[info.name] = GL.getAttribLocation(this.program, info.name);
        }
      }
    } catch (e) {
      console.error(e);
    }
    GL.useProgram(null);
  }

  /**
   * Get uniform location
   * @param {string} name
   * @returns {WebGLUniformLocation | null}
   */
  public uniform(name: string): WebGLUniformLocation | null {
    const entry = this.uniforms.find((en) => en.name === name);

    return entry ? entry.location : null;
  }

  /**
   * Get vertex attribute location
   * @param {string} name
   * @returns {number}
   */
  public attribute(name: string): number {
    return this.attributes[name] ?? -1;
  }

  /**
   * Set buffer with render data
   * @param name
   * @param buffer
   * @param size
   * @param type
   * @param normalized
   * @param stride
   * @param offset
   * @param intPointer
   */
  public setBuffer(
    name: string,
    buffer: WebGLBuffer,
    size: number,
    type: GLenum,
    normalized: boolean = false,
    stride: number = 0,
    offset: number = 0,
    intPointer: boolean = false,
  ) {
    const idx = this.attribute(name);
    if (idx !== -1) {
      GL.enableVertexAttribArray(idx);
      GL.bindBuffer(GL.ARRAY_BUFFER, buffer);
      if (intPointer) {
        GL.vertexAttribIPointer(idx, size, type, stride, offset);
      } else {
        GL.vertexAttribPointer(idx, size, type, normalized, stride, offset);
      }
      if (!this.boundAttributes.includes(idx)) {
        this.boundAttributes.push(idx);
      }
    }
  }

  public setUniforms() {}

  /**
   * Draw mesh
   * @param buffer
   * @param count
   * @param mode
   * @param type
   * @param offset
   * @param instanceCount
   */
  public draw(
    buffer: WebGLBuffer,
    count: number,
    mode: GLenum = GL.TRIANGLES,
    type: GLenum = GL.UNSIGNED_SHORT,
    offset: number = 0,
    instanceCount: number = 0,
  ) {
    if (buffer !== this.indexBuffer) {
      GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, buffer);
      this.indexBuffer = buffer;
    }
    if (instanceCount > 0) {
      GL.drawElementsInstanced(mode, count, type, offset, instanceCount);
    } else {
      GL.drawElements(mode, count, type, offset);
    }
  }

  /**
   * Bind texture to pipeline
   * @param name
   * @param texture
   * @param target
   */
  public setTexture(name: string, texture: WebGLTexture, target: GLenum = GL.TEXTURE_2D) {
    const location = this.uniform(name);
    if (location) {
      let found = true;
      let index = this.textureQuota.findIndex(
        (tx) => tx.texture === texture && tx.target === target,
      );
      if (index === -1) {
        index = this.textureQuota.length;
        this.textureQuota.push({
          texture,
          target,
        });
        found = false;
      }

      if (!found) {
        GL.activeTexture(GL.TEXTURE0 + index);
        GL.bindTexture(target, texture);
      }
      GL.uniform1i(location, index);
    }
  }

  /**
   * Get connected matrix
   * @param {mat4} model
   */
  public updateMatrix(model: mat4) {
    this.modelMatrix = model;
    // if (this.)
  }

  /**
   * Setting as active pipeline shader
   */
  public bind() {
    GL.useProgram(this.program);
    GL.uniformMatrix4fv(this.uniform('projMat'), false, Shader.projMatrix);
    GL.uniformMatrix4fv(this.uniform('viewMat'), false, Shader.viewMatrix);
    GL.uniformMatrix4fv(this.uniform('modelMat'), false, this.modelMatrix);
  }

  // public setUniforms(value: UniformCollection) {
  //   this.setUniformTree(value);
  // }

  // private setUniformTree(value: UniformCollection, prefix: string = '') {
  //   for (const name in value) {
  //     if (value.hasOwnProperty(name)) {
  //
  //
  //     }
  //   }
  // }

  /**
   * Detaching shader from pipeline
   */
  public unbind() {
    for (let i = this.textureQuota.length - 1; i >= 0; i--) {
      const tex = this.textureQuota[i];
      GL.activeTexture(GL.TEXTURE0 + i);
      GL.bindTexture(tex.target, null);
    }
    for (const index of this.boundAttributes) {
      GL.disableVertexAttribArray(index);
    }
    if (this.indexBuffer) {
      GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, null);
      this.indexBuffer = null;
    }
    GL.useProgram(null);
    this.textureQuota.length = 0;
    this.boundAttributes.length = 0;
  }

  /**
   * Method for shader program compilation
   * @param {string} source
   * @param {GLenum} type
   * @returns {WebGLShader}
   * @private
   */
  private createShader(source: string, type: GLenum): WebGLShader {
    // Allocating shader object
    const shader = GL.createShader(type);
    if (!shader) {
      throw new Error('[Shader] Unable to allocate shader');
    }

    // Binding source code and compile
    GL.shaderSource(shader, source);
    GL.compileShader(shader);
    if (!GL.getShaderParameter(shader, GL.COMPILE_STATUS)) {
      throw new Error(
        `[Shader] Unable to compile shader\n\n${source}\n\n${GL.getShaderInfoLog(shader)}`,
      );
    }

    // Shader is complete
    return shader;
  }

  /**
   * Method for program linkage
   * @returns {WebGLProgram}
   * @private
   */
  private createProgram(): WebGLProgram {
    // Allocating program
    const program = GL.createProgram();
    if (!program) {
      throw new Error('[Shader] Unable to allocate shader program');
    }

    // Linking program altogether
    GL.attachShader(program, this.vertexShader!);
    GL.attachShader(program, this.fragmentShader!);

    GL.linkProgram(program);
    if (!GL.getProgramParameter(program, GL.LINK_STATUS)) {
      throw new Error(`[Shader] Unable to link program\n\n${GL.getProgramInfoLog(program)}`);
    }

    // Program is complete
    return program;
  }

  /**
   * Prefixing vertex code with base shader
   * @private
   */
  private prefixVertexCode(defines: DefineList) {
    return `${VertexBase.replace('// DEFINE_LIST', this.buildDefines(defines))}\n${
      this.vertexCode
    }`;
  }

  /**
   * Prefixing fragment code with base shader
   * @private
   */
  private prefixFragmentCode(offscreen: boolean, defines: DefineList) {
    return `${FragmentBase.replace(
      '// DEFINE_LIST',
      this.buildDefines(offscreen ? { ...defines, OFFSCREEN_PASS: 1 } : defines),
    )}\n${this.fragmentCode}`;
  }

  /**
   * Build defines
   * @param defines
   * @private
   */
  private buildDefines(defines: DefineList) {
    const lines: string[] = [];
    for (const n in defines) {
      if (defines.hasOwnProperty(n)) {
        lines.push(`#define ${n} ${defines[n]}`);
      }
    }

    return `${lines.join('\n')}\n`;
  }
}
