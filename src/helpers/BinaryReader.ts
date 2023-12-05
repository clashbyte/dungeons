import { quat, vec3 } from 'gl-matrix';

export class BinaryReader {
  private pos = 0;

  private readonly littleEndian: boolean = true;

  private readonly stream: DataView;

  public get buffer() {
    return this.stream.buffer;
  }

  public get offset() {
    return this.pos;
  }

  public set offset(value: number) {
    this.pos = value;
  }

  public get length() {
    return this.stream.byteLength;
  }

  public constructor(data: ArrayBuffer, littleEndian: boolean = true) {
    this.littleEndian = littleEndian;
    this.pos = 0;
    this.stream = new DataView(data);
  }

  public readByte() {
    this.pos++;

    return this.stream.getUint8(this.pos - 1);
  }

  public readSignedByte() {
    this.pos++;

    return this.stream.getInt8(this.pos - 1);
  }

  public readShort() {
    this.pos += 2;

    return this.stream.getUint16(this.pos - 2, this.littleEndian);
  }

  public readSignedShort() {
    this.pos += 2;

    return this.stream.getInt16(this.pos - 2, this.littleEndian);
  }

  public readInt() {
    this.pos += 4;

    return this.stream.getInt32(this.pos - 4, this.littleEndian);
  }

  public readUInt() {
    this.pos += 4;

    return this.stream.getUint32(this.pos - 4, this.littleEndian);
  }

  public readFloat() {
    this.pos += 4;

    return this.stream.getFloat32(this.pos - 4, this.littleEndian);
  }

  public readVec3() {
    const x = this.readFloat();
    const y = this.readFloat();
    const z = this.readFloat();

    return vec3.fromValues(x, y, z);
  }

  public readQuat() {
    const x = this.readFloat();
    const y = this.readFloat();
    const z = this.readFloat();
    const w = this.readFloat();

    return quat.fromValues(x, y, z, w);
  }

  public readFixedString(length: number) {
    const chars: number[] = [];
    for (let i = 0; i < length; i++) {
      const ch = this.readByte();
      if (ch === 0) {
        break;
      }
      chars[i] = ch;
    }
    if (chars.length < length) {
      this.pos += length - chars.length - 1;
    }

    return chars.map((char) => String.fromCharCode(char)).join('');
  }

  public readString() {
    const len = this.readShort();

    return this.readFixedString(len);
  }

  public readBytes(count: number) {
    const out: number[] = [];
    for (let i = 0; i < count; i++) {
      out.push(this.readByte());
    }

    return out;
  }

  public readArrayBytes(count: number) {
    this.pos += count;

    return new Uint8Array(this.stream.buffer.slice(this.pos - count, this.pos));
  }
}
