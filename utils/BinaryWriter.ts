import { quat, vec3 } from 'gl-matrix';

export class BinaryWriter {
  private pos = 0;

  private readonly littleEndian: boolean = true;

  private readonly stream: DataView;

  public get offset() {
    return this.pos;
  }

  public set offset(value: number) {
    this.pos = value;
  }

  public get length() {
    return this.stream.byteLength;
  }

  public get buffer() {
    return this.stream;
  }

  public constructor(data: ArrayBuffer, littleEndian: boolean = true) {
    this.littleEndian = littleEndian;
    this.pos = 0;
    this.stream = new DataView(data);
  }

  public writeByte(value: number) {
    this.pos++;

    this.stream.setUint8(this.pos - 1, value);
  }

  public writeSignedByte(value: number) {
    this.pos++;

    this.stream.setInt8(this.pos - 1, value);
  }

  public writeShort(value: number) {
    this.pos += 2;

    this.stream.setUint16(this.pos - 2, value, this.littleEndian);
  }

  public writeSignedShort(value: number) {
    this.pos += 2;

    this.stream.setInt16(this.pos - 2, value, this.littleEndian);
  }

  public writeInt(value: number) {
    this.pos += 4;

    this.stream.setInt32(this.pos - 4, value, this.littleEndian);
  }

  public writeUnsignedInt(value: number) {
    this.pos += 4;

    this.stream.setUint32(this.pos - 4, value, this.littleEndian);
  }

  public writeFloat(value: number) {
    this.pos += 4;

    this.stream.setFloat32(this.pos - 4, value, this.littleEndian);
  }

  public writeVec3(v: vec3) {
    this.writeFloat(v[0]);
    this.writeFloat(v[1]);
    this.writeFloat(v[2]);
  }

  public writeQuat(q: quat) {
    this.writeFloat(q[0]);
    this.writeFloat(q[1]);
    this.writeFloat(q[2]);
    this.writeFloat(q[3]);
  }

  public writeFixedString(text: string, length: number | undefined = undefined) {
    const len = length ?? text.length;
    let s = text;
    if (s.length > len) {
      s = s.substring(0, len);
    }
    for (let i = 0; i < s.length; i++) {
      this.writeByte(s.charCodeAt(i));
    }
    if (s.length < len) {
      for (let i = 0; i < len - s.length; i++) {
        this.writeByte(0);
      }
    }
  }

  public writeString(text: string) {
    this.writeShort(text.length);
    for (let i = 0; i < text.length; i++) {
      this.writeByte(text.charCodeAt(i));
    }
  }
}
