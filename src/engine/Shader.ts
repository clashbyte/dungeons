import { mat3, mat4, vec2, vec3, vec4 } from 'gl-matrix';
import { GL } from '@/core/GL.ts';
import FragmentBase from '@/shaders/common/prefix.frag.glsl';
import VertexBase from '@/shaders/common/prefix.vert.glsl';

type UniformLoc = {
  location: WebGLUniformLocation;
  name: string;
  type: GLenum;
  size: number;
};
type Lookup<T> = { [key: string]: T | null };
type UniformValue = number | vec2 | vec3 | vec4 | mat3 | mat4 | WebGLTexture;
type UniformCollection = { [key: string]: UniformValue | UniformValue[] | UniformCollection };
type DefineList = { [key: string]: string | number };
type UniformSetter = ((value: UniformValue) => void) | ((value: UniformValue[]) => void);
type UniformBranch = { [key: string]: UniformSetter | UniformBranch | UniformBranch[] };

interface ShaderOptions {
  deferred?: boolean;
  defines?: DefineList;
  forceAttribIndices?: { [key: string]: number };
  transformFeedbackVaryings?: string[];
  transformFeedbackSeparate?: boolean;
}

const FLOAT = 5126;
const FLOAT_VEC2 = 35664;
const FLOAT_VEC3 = 35665;
const FLOAT_VEC4 = 35666;
const INT = 5124;
const INT_VEC2 = 35667;
const INT_VEC3 = 35668;
const INT_VEC4 = 35669;
const BOOL = 35670;
const BOOL_VEC2 = 35671;
const BOOL_VEC3 = 35672;
const BOOL_VEC4 = 35673;
const FLOAT_MAT2 = 35674;
const FLOAT_MAT3 = 35675;
const FLOAT_MAT4 = 35676;
const SAMPLER_2D = 35678;
const SAMPLER_CUBE = 35680;
const SAMPLER_3D = 35679;
const SAMPLER_2D_SHADOW = 35682;
// const FLOAT_MAT2x3 = 35685;
// const FLOAT_MAT2x4 = 35686;
// const FLOAT_MAT3x2 = 35687;
// const FLOAT_MAT3x4 = 35688;
// const FLOAT_MAT4x2 = 35689;
// const FLOAT_MAT4x3 = 35690;
// const SAMPLER_2D_ARRAY = 36289;
// const SAMPLER_2D_ARRAY_SHADOW = 36292;
// const SAMPLER_CUBE_SHADOW = 36293;
const UNSIGNED_INT = 5125;
const UNSIGNED_INT_VEC2 = 36294;
const UNSIGNED_INT_VEC3 = 36295;
const UNSIGNED_INT_VEC4 = 36296;
const INT_SAMPLER_2D = 36298;
const INT_SAMPLER_3D = 36299;
const INT_SAMPLER_CUBE = 36300;
// const INT_SAMPLER_2D_ARRAY = 36303;
const UNSIGNED_INT_SAMPLER_2D = 36306;
const UNSIGNED_INT_SAMPLER_3D = 36307;
const UNSIGNED_INT_SAMPLER_CUBE = 36308;
// const UNSIGNED_INT_SAMPLER_2D_ARRAY = 36311;

/**
 * Класс-обертка для шейдеров
 */
export class Shader {
  /**
   * Текущий активный шейдер
   */
  private static activeShader: Shader | null = null;

  /**
   * Матрица проекции
   */
  private static viewMatrix: mat4 = mat4.identity(mat4.create());

  /**
   * Обратная матрица камеры
   */
  private static projMatrix: mat4 = mat4.identity(mat4.create());

  /**
   * Normal matrix for view-space
   * @private
   */
  private static viewNormalMatrix: mat3 = mat3.identity(mat3.create());

  /**
   * Необработанный вершинный код
   */
  private readonly vertexCode: string;

  /**
   * Необработанный фрагментный код
   */
  private readonly fragmentCode: string;

  /**
   * Вершинный WebGL-шейдер
   */
  private readonly vertexShader: WebGLShader | null;

  /**
   * Фрагментный WebGL-шейдер
   */
  private readonly fragmentShader: WebGLShader | null;

  /**
   * WebGL-программа (связка вершинного и фрагментного шейдеров)
   */
  private readonly program: WebGLProgram | null;

  /**
   * Таблица юниформов
   */
  private readonly uniforms: UniformLoc[] = [];

  /**
   * Сеттеры для юниформов
   */
  private readonly uniformSetters: UniformBranch;

  /**
   * Таблица вертексных атрибутов
   */
  private readonly attributes: Lookup<number>;

  /**
   * Явно указанные индексы атрибутов
   */
  private readonly options: ShaderOptions;

  /**
   * Текущая матрица объекта
   */
  private modelMatrix: mat4;

  /**
   * Привязанные в пайплайн текстуры
   */
  private readonly textureQuota: { texture: WebGLTexture; target: GLenum; location: UniformLoc }[] =
    [];

  /**
   * Привязанные атрибуты
   */
  private readonly boundAttributes: number[] = [];

  /**
   * Активный индексный буффер
   */
  private indexBuffer: WebGLBuffer | null = null;

  /**
   * Обновление матриц камеры и проекции
   * @param viewMatrix Обратная матрица камеры
   * @param projMatrix Матрица проекции
   */
  public static updateCamera(viewMatrix: mat4, projMatrix: mat4, viewNormalMatrix: mat3) {
    this.viewMatrix = viewMatrix;
    this.projMatrix = projMatrix;
    this.viewNormalMatrix = viewNormalMatrix;
  }

  /**
   * Конструктор шейдера
   * @param fragCode Код фрагментного шейдера
   * @param vertCode Код вершинного шейдера
   * @param options Настройки
   */
  public constructor(fragCode: string, vertCode: string, options?: ShaderOptions) {
    this.options = {
      defines: {
        ...options?.defines,
      },
      forceAttribIndices: undefined,
      transformFeedbackVaryings: undefined,
      ...options,
    };
    if (options && options.deferred) {
      this.options.defines!.DEFERRED_PASS = 'true';
    }
    this.fragmentCode = fragCode;
    this.vertexCode = vertCode;
    this.modelMatrix = mat4.identity(mat4.create());
    this.uniforms = [];
    this.attributes = {};
    this.vertexShader = null;
    this.fragmentShader = null;
    this.program = null;
    this.uniformSetters = {};

    try {
      // Компиляция фрагментного и вершинного шейдера
      this.vertexShader = this.createShader(this.prefixVertexCode(), GL.VERTEX_SHADER);
      this.fragmentShader = this.createShader(this.prefixFragmentCode(), GL.FRAGMENT_SHADER);
      this.program = this.createProgram();
      GL.useProgram(this.program);

      // Получение адресов всех доступных юниформов
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
      this.uniformSetters = this.parseUniformTree(this.uniforms);

      // Получение индексов атрибутов
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
   * Получение локейшна юниформа по имени
   * @param name Имя юниформа
   * @returns Локейшн или null
   */
  public uniform(name: string): WebGLUniformLocation | null {
    const entry = this.uniforms.find((en) => en.name === name);

    return entry ? entry.location : null;
  }

  /**
   * Получение индекса вершинного атрибута
   * @param name Название
   * @returns Индекс атрибута
   */
  public attribute(name: string): number {
    return this.attributes[name] ?? -1;
  }

  /**
   * Установка буффера в пайплайн
   * @param name Имя атрибута
   * @param buffer Буффер с данными
   * @param size Количество компонентов
   * @param type Тип одного компонента
   * @param normalized Нормализация данных (не связано с нормалями!)
   * @param stride Размер пропуска для каждой вершины в байтах
   * @param offset Сдвиг от начала буффера
   * @param intPointer Флаг для целочисленных данных
   * @param instancedPointer Флаг для инстанс-данных
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
    instancedPointer: boolean = false,
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
      GL.vertexAttribDivisor(idx, instancedPointer ? 1 : 0);
      if (!this.boundAttributes.includes(idx)) {
        this.boundAttributes.push(idx);
      }
    }
  }

  /**
   * Отрисовка меша
   * @param buffer Индексный буффер
   * @param count Количество вершин в индексном буффере
   * @param mode Тип примитива
   * @param type Формат одного индекса
   * @param offset Сдвиг от начала буфера
   * @param instanceCount Количество инстансов
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
   * Установка текстуры в пайплайн
   * @param name Имя семплера
   * @param texture Текстура
   * @param target Режим текстуры
   */
  public setTexture(name: string, texture: WebGLTexture, target: GLenum = GL.TEXTURE_2D) {
    const location = this.uniforms.find((u) => u.name === name);
    if (location) {
      const idx = this.bindTexture(location, texture, target);
      GL.uniform1i(location.location, idx);
    }
  }

  /**
   * Обновление матрицы объекта
   * @param model Матрица
   */
  public updateMatrix(model: mat4) {
    this.modelMatrix = model;
    if (Shader.activeShader === this) {
      GL.uniformMatrix4fv(this.uniform('modelMat'), false, this.modelMatrix);
    }
  }

  /**
   * Привязка шейдера в отрисовку
   */
  public bind() {
    Shader.activeShader = this;
    GL.useProgram(this.program);
    GL.uniformMatrix4fv(this.uniform('projMat'), false, Shader.projMatrix);
    GL.uniformMatrix4fv(this.uniform('viewMat'), false, Shader.viewMatrix);
    GL.uniformMatrix3fv(this.uniform('viewNormalMat'), false, Shader.viewNormalMatrix);
    GL.uniformMatrix4fv(this.uniform('modelMat'), false, this.modelMatrix);
  }

  /**
   * Установка юниформов
   * @param value Объект со значениями юниформов
   */
  public setUniforms(value: UniformCollection) {
    this.setUniformTree(value, this.uniformSetters);
  }

  /**
   * Отвязка шейдера из пайплайна
   */
  public unbind() {
    Shader.activeShader = null;

    // Выключение привязанных текстур
    for (let i = this.textureQuota.length - 1; i >= 0; i--) {
      const tex = this.textureQuota[i];
      GL.activeTexture(GL.TEXTURE0 + i);
      GL.bindTexture(tex.target, null);
    }

    // Отключение буфферов
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
   * Компиляция шейдера
   * @param source Код
   * @param type Тип шейдера
   * @returns Инстанс шейдера
   */
  private createShader(source: string, type: GLenum): WebGLShader {
    // Создание шейдера
    const shader = GL.createShader(type);
    if (!shader) {
      throw new Error('[Shader] Unable to allocate shader');
    }

    // Загрузка кода и попытка компиляции
    GL.shaderSource(shader, source);
    GL.compileShader(shader);
    if (!GL.getShaderParameter(shader, GL.COMPILE_STATUS)) {
      throw new Error(
        `[Shader] Unable to compile shader\n\n${source}\n\n${GL.getShaderInfoLog(shader)}`,
      );
    }

    return shader;
  }

  /**
   * Создание и линковка программы
   * @returns WebGL-программа
   */
  private createProgram(): WebGLProgram {
    // Создание программы
    const program = GL.createProgram();
    if (!program) {
      throw new Error('[Shader] Unable to allocate shader program');
    }

    // Линковка шейдеров и компиляция
    GL.attachShader(program, this.vertexShader!);
    GL.attachShader(program, this.fragmentShader!);
    if (this.options.forceAttribIndices) {
      for (const name in this.options.forceAttribIndices) {
        if (name in this.options.forceAttribIndices) {
          GL.bindAttribLocation(program, this.options.forceAttribIndices[name], name);
        }
      }
    }

    // Привязка трансформ фидбека, если он есть
    if (this.options.transformFeedbackVaryings) {
      GL.transformFeedbackVaryings(
        program,
        this.options.transformFeedbackVaryings,
        this.options.transformFeedbackSeparate ? GL.SEPARATE_ATTRIBS : GL.INTERLEAVED_ATTRIBS,
      );
    }

    GL.linkProgram(program);
    if (!GL.getProgramParameter(program, GL.LINK_STATUS)) {
      throw new Error(`[Shader] Unable to link program\n\n${GL.getProgramInfoLog(program)}`);
    }

    // Program is complete
    return program;
  }

  /**
   * Добавление префикса к вершинному коду
   */
  private prefixVertexCode() {
    return `${VertexBase.replace('SHADER_DEFINE_LIST;', this.buildDefines())}\n${this.vertexCode}`;
  }

  /**
   * Добавление префикса к фрагментному коду
   */
  private prefixFragmentCode() {
    return `${FragmentBase.replace('SHADER_DEFINE_LIST;', this.buildDefines())}\n${
      this.fragmentCode
    }`;
  }

  /**
   * Сборка #define-директив
   */
  private buildDefines() {
    const defines = this.options.defines ?? {};
    const lines: string[] = [];
    for (const n in defines) {
      if (defines.hasOwnProperty(n)) {
        lines.push(`#define ${n} ${defines[n]}`);
      }
    }

    return `${lines.join('\n')}\n`;
  }

  /**
   * Декодирование списка юниформов в сеттеры
   * @param uniforms Локейшены юниформов
   * @param prefix Префикс текущей ветви
   * @param depth Глубина
   */
  private parseUniformTree(
    uniforms: UniformLoc[],
    prefix: string = '',
    depth: number = 0,
  ): UniformBranch {
    const nodes: UniformBranch = {};
    const list = prefix.length > 0 ? uniforms.filter((v) => v.name.startsWith(prefix)) : uniforms;
    const visited: string[] = [];
    for (const u of list) {
      const raw = prefix ? u.name.substring(prefix.length) : u.name;
      const matches = raw.match(/^[a-z]([a-z0-9]+)?/gimu);
      if (matches) {
        const base = matches[0];
        if (!visited.includes(base)) {
          visited.push(base);
          if (base === raw) {
            // Прямой сеттер
            nodes[base] = this.getUniformSetter(u);
          } else {
            const isArray = raw.substring(base.length, base.length + 1) === '[';
            if (isArray) {
              let count = 0;
              list.forEach((v) => {
                if (v.name.substring(prefix.length).startsWith(base)) {
                  const num = Number(
                    v.name.substring(
                      base.length + prefix.length + 1,
                      v.name.indexOf(']', base.length + prefix.length + 1),
                    ),
                  );
                  count = Math.max(count, num + 1);
                }
              });
              if (count === 1 && u.size !== 1) {
                nodes[base] = this.getUniformSetter(u);
              } else {
                const arr: UniformBranch[] = [];
                for (let i = 0; i < count; i++) {
                  arr.push(this.parseUniformTree(uniforms, `${prefix}${base}[${i}].`, depth + 1));
                }
                nodes[base] = arr;
              }
            } else {
              nodes[base] = this.parseUniformTree(
                uniforms,
                `${prefix ? prefix + base : base}.`,
                depth + 1,
              );
            }
          }
        }
      }
    }

    return nodes;
  }

  /**
   * Получение сеттера для юниформа из его типа и размерности
   * @param field Юниформ
   */
  private getUniformSetter(field: UniformLoc): UniformSetter {
    let setter:
      | {
          func:
            | ((
                this: WebGLRenderingContext,
                location: WebGLUniformLocation | null,
                value: number,
              ) => void)
            | ((
                this: WebGLRenderingContext,
                location: WebGLUniformLocation | null,
                value: number[] | Iterable<number>,
              ) => void);
          mat: false;
          sampler: false;
        }
      | {
          func: (
            this: WebGLRenderingContext,
            location: WebGLUniformLocation | null,
            transpose: boolean,
            value: Iterable<number>,
          ) => void;
          mat: true;
          sampler: false;
        }
      | {
          func: (
            this: WebGLRenderingContext,
            location: WebGLUniformLocation | null,
            value: number,
          ) => void;
          mat: false;
          sampler: number;
        }
      | null = null;

    switch (field.type) {
      case FLOAT:
        setter = {
          func: field.size > 1 ? GL.uniform1fv : GL.uniform1f,
          mat: false,
          sampler: false,
        };
        break;

      case FLOAT_VEC2:
        setter = {
          func: GL.uniform2fv,
          mat: false,
          sampler: false,
        };
        break;

      case FLOAT_VEC3:
        setter = {
          func: GL.uniform3fv,
          mat: false,
          sampler: false,
        };
        break;

      case FLOAT_VEC4:
        setter = {
          func: GL.uniform4fv,
          mat: false,
          sampler: false,
        };
        break;

      case INT:
      case BOOL:
        setter = {
          func: field.size > 1 ? GL.uniform1iv : GL.uniform1i,
          mat: false,
          sampler: false,
        };
        break;

      case INT_VEC2:
      case BOOL_VEC2:
        setter = {
          func: GL.uniform2iv,
          mat: false,
          sampler: false,
        };
        break;

      case INT_VEC3:
      case BOOL_VEC3:
        setter = {
          func: GL.uniform3iv,
          mat: false,
          sampler: false,
        };
        break;

      case INT_VEC4:
      case BOOL_VEC4:
        setter = {
          func: GL.uniform4iv,
          mat: false,
          sampler: false,
        };
        break;

      case UNSIGNED_INT:
        setter = {
          func: field.size > 1 ? GL.uniform1uiv : GL.uniform1ui,
          mat: false,
          sampler: false,
        };
        break;

      case UNSIGNED_INT_VEC2:
        setter = {
          func: GL.uniform2uiv,
          mat: false,
          sampler: false,
        };
        break;

      case UNSIGNED_INT_VEC3:
        setter = {
          func: GL.uniform3uiv,
          mat: false,
          sampler: false,
        };
        break;

      case UNSIGNED_INT_VEC4:
        setter = {
          func: GL.uniform4uiv,
          mat: false,
          sampler: false,
        };
        break;

      case FLOAT_MAT2:
        setter = {
          func: GL.uniformMatrix2fv,
          mat: true,
          sampler: false,
        };
        break;

      case FLOAT_MAT3:
        setter = {
          func: GL.uniformMatrix3fv,
          mat: true,
          sampler: false,
        };
        break;

      case FLOAT_MAT4:
        setter = {
          func: GL.uniformMatrix4fv,
          mat: true,
          sampler: false,
        };
        break;

      case SAMPLER_2D:
      case SAMPLER_2D_SHADOW:
      case INT_SAMPLER_2D:
      case UNSIGNED_INT_SAMPLER_2D:
        setter = {
          func: GL.uniform1i,
          mat: false,
          sampler: GL.TEXTURE_2D,
        };
        break;

      case SAMPLER_3D:
      case INT_SAMPLER_3D:
      case UNSIGNED_INT_SAMPLER_3D:
        setter = {
          func: GL.uniform1i,
          mat: false,
          sampler: GL.TEXTURE_3D,
        };
        break;

      case SAMPLER_CUBE:
      case INT_SAMPLER_CUBE:
      case UNSIGNED_INT_SAMPLER_CUBE:
        setter = {
          func: GL.uniform1i,
          mat: false,
          sampler: GL.TEXTURE_CUBE_MAP,
        };
        break;

      default:
        setter = null;
        break;
    }

    if (setter) {
      return (value: UniformValue) => {
        const { func, mat, sampler } = setter!;
        if (setter) {
          const v = Array.isArray(value) ? value.flat() : value;
          if (mat) {
            func.call(GL, field.location, false, v as Iterable<number>);
          } else if (sampler !== false) {
            if (v instanceof WebGLTexture) {
              const idx = this.bindTexture(field, v, sampler);
              func.call(GL, field.location, idx);
            }
          } else {
            // @ts-ignore
            func.call(GL, field.location, v as number | Iterable<number>);
          }
        }
      };
    }

    return () => {};
  }

  /**
   * Обновление одной ветви юниформов
   * @param value Значение
   * @param tree Текущая ветвь
   */
  private setUniformTree(value: UniformCollection, tree: UniformBranch) {
    for (const name in value) {
      if (value.hasOwnProperty(name) && tree.hasOwnProperty(name)) {
        const field = tree[name];

        if (typeof field === 'function') {
          // @ts-ignore
          field(value[name]);
        } else {
          const sub = value[name];
          if (Array.isArray(field)) {
            if (Array.isArray(sub)) {
              for (let i = 0; i < field.length; i++) {
                if (sub[i]) {
                  this.setUniformTree(sub[i], field[i]);
                }
              }
            }
          } else {
            this.setUniformTree(sub as UniformCollection, field);
          }
        }
      }
    }
  }

  /**
   * Установка текстуры в пайплайн
   * @param location Семплер
   * @param texture Текстура
   * @param target Режим текстуры
   */
  private bindTexture(location: UniformLoc, texture: WebGLTexture, target: GLenum = GL.TEXTURE_2D) {
    let found = true;
    let index = this.textureQuota.findIndex(
      (tx) => tx.texture === texture && tx.target === target && tx.location === location,
    );
    if (index === -1) {
      index = this.textureQuota.length;
      this.textureQuota.push({
        texture,
        target,
        location,
      });
      found = false;
    }

    if (!found) {
      GL.activeTexture(GL.TEXTURE0 + index);
      GL.bindTexture(target, texture);
      // GL.texParameteri(target, );
    }

    return index;
  }
}
