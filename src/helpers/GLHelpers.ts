import { GL } from '../core/GL';

export interface TextureAtlasFrame {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextureAtlas {
  map: WebGLTexture;
  width: number;
  height: number;
  frames: TextureAtlasFrame[];
}

export function createVertexBuffer(data: BufferSource, hint: GLenum = GL.STATIC_DRAW) {
  const buffer = GL.createBuffer()!;
  updateVertexBuffer(buffer, data, hint);

  return buffer;
}

export function updateVertexBuffer(
  buffer: WebGLBuffer,
  data: BufferSource,
  hint: GLenum = GL.STATIC_DRAW,
) {
  GL.bindBuffer(GL.ARRAY_BUFFER, buffer);
  GL.bufferData(GL.ARRAY_BUFFER, data, hint);
  GL.bindBuffer(GL.ARRAY_BUFFER, null);
}

export function createIndexBuffer(data: Uint16Array) {
  const buffer = GL.createBuffer()!;

  GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, buffer);
  GL.bufferData(GL.ELEMENT_ARRAY_BUFFER, data, GL.STATIC_DRAW);
  GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, null);

  return buffer;
}

export function createTexture(img: HTMLImageElement, mipmap: boolean = true) {
  const tex = GL.createTexture()!;
  GL.bindTexture(GL.TEXTURE_2D, tex);
  GL.texImage2D(
    GL.TEXTURE_2D,
    0,
    GL.RGBA,
    img.width,
    img.height,
    0,
    GL.RGBA,
    GL.UNSIGNED_BYTE,
    img,
  );
  GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.REPEAT);
  GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.REPEAT);
  GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR);
  if (mipmap) {
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR_MIPMAP_LINEAR);
    GL.generateMipmap(GL.TEXTURE_2D);
  } else {
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR);
  }
  GL.bindTexture(GL.TEXTURE_2D, null);

  return tex;
}

export async function loadTexture(url: string, mipmap: boolean = true): Promise<WebGLTexture> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => {
      resolve(createTexture(img, mipmap));
    });
    img.addEventListener('error', () => reject());
    img.src = url;
  });
}

export async function loadTextureAtlas(
  imageUrl: string,
  frames: TextureAtlasFrame[],
): Promise<TextureAtlas> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => {
      resolve(image);
    });
    image.addEventListener('error', reject);
    image.src = imageUrl;
  });

  return {
    map: createTexture(img, false),
    width: img.width,
    height: img.height,
    frames,
  };
}
