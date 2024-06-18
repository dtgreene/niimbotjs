import assert from 'node:assert';

export class Packet {
  type: number;
  data: Buffer;
  constructor(type: number, data: Buffer) {
    this.type = type;
    this.data = data;
  }
  static fromBytes = (bytes: Buffer) => {
    const bytesLength = bytes.length;

    assert(bytes[0] === 0x55, 'Invalid start bytes');
    assert(bytes[1] === 0x55, 'Invalid start bytes');
    assert(bytes[bytesLength - 1] === 0xaa, 'Invalid end bytes');
    assert(bytes[bytesLength - 2] === 0xaa, 'Invalid end bytes');

    const type = bytes[2];
    const length = bytes[3];
    const data = bytes.subarray(4, 4 + length);
    const checksum = getChecksum(type, data);

    assert(checksum === bytes[bytesLength - 3], 'Invalid checksum');

    return new Packet(type, data);
  };
  toBytes = () => {
    const start = Buffer.from([0x55, 0x55, this.type, this.data.length]);
    const end = Buffer.from([getChecksum(this.type, this.data), 0xaa, 0xaa]);

    return Buffer.concat([start, this.data, end]);
  };
}

function getChecksum(type: number, data: Buffer) {
  return data.reduce((result, byte) => (result ^= byte), type ^ data.length);
}
