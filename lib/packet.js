import assert from 'node:assert';

export class PrinterPacket {
  constructor(type, data) {
    this.type = type;
    this.data = data;
  }
  static fromBytes = (bytes) => {
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

    return new PrinterPacket(type, data);
  };
  toBytes = () => {
    if (this.data instanceof Buffer) {
      this.data = Array.from(this.data.values());
    }

    const bytes = [
      0x55,
      0x55,
      this.type,
      this.data.length,
      this.data,
      getChecksum(this.type, this.data),
      0xaa,
      0xaa,
    ].flat();

    return Buffer.from(bytes);
  };
}

function getChecksum(type, data) {
  return data.reduce((result, byte) => (result ^= byte), type ^ data.length);
}
