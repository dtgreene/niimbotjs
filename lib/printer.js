import assert from 'node:assert/strict';

import { PrinterPacket } from './packet.js';
import { SerialTransport } from './transport.js';
import { wait, debugLog, warnLog } from './utils.js';

const PACKET_TYPE_VALUE_ERROR = 219;
const PACKET_TYPE_UNIMPLEMENTED_ERROR = 0;
const PACKET_READ_INTERVAL = 100;
const PACKET_READ_COUNT = 10;

export const InfoCode = {
  DENSITY: 1,
  PRINT_SPEED: 2,
  LABEL_TYPE: 3,
  LANGUAGE_TYPE: 6,
  AUTO_SHUTDOWN_TIME: 7,
  DEVICE_TYPE: 8,
  SOFTWARE_VERSION: 9,
  BATTERY: 10,
  DEVICE_SERIAL: 11,
  HARDWARE_VERSION: 12,
};

export const RequestCode = {
  GET_INFO: 64,
  GET_RFID: 26,
  GET_HEART_BEAT: 220,
  SET_LABEL_TYPE: 35,
  SET_LABEL_DENSITY: 33,
  START_PRINT: 1,
  END_PRINT: 243,
  START_PAGE_PRINT: 3,
  END_PAGE_PRINT: 227,
  ALLOW_PRINT_CLEAR: 32,
  SET_DIMENSION: 19,
  GET_PRINT_STATUS: 163,
  IMAGE_DATA: 133,
};

export class PrinterClient {
  packetBuffer = null;
  transport = new SerialTransport();
  open = (path) => {
    return this.transport.open(path);
  };
  close = () => {
    this.transport.close();
  };
  _sendPacket = async (type, data, options = {}) => {
    const { responseOffset = 1, skipResponse = false } = options;

    debugLog('Writing packet!', type, data);

    const packet = new PrinterPacket(type, data);
    const responseCode = responseOffset + type;

    this.transport.write(packet.toBytes());
    const response = await this._receivePacket(responseCode);

    if (skipResponse) return;
    if (response) {
      return response;
    } else {
      throw new Error('Expected response was never received');
    }
  };
  _receivePacket = async (responseCode) => {
    for (let i = 0; i < PACKET_READ_COUNT; i++) {
      const packets = this._processChunk();

      for (let j = 0; j < packets.length; j++) {
        const packet = packets[j];

        switch (packet.type) {
          case PACKET_TYPE_VALUE_ERROR: {
            throw new Error('Received value error');
          }
          case PACKET_TYPE_UNIMPLEMENTED_ERROR: {
            throw new Error('Received unimplemented error');
          }
          case responseCode: {
            return packet;
          }
          default: {
            debugLog(
              `Expected response code ${responseCode} but received ${packet.type}!`
            );
          }
        }
      }

      // Pause before the next iteration
      await wait(PACKET_READ_INTERVAL);
    }

    return null;
  };
  _processChunk = () => {
    const packets = [];
    const chunk = this.transport.read();

    if (!chunk) return packets;

    debugLog('Received chunk!', chunk);

    if (this.packetBuffer) {
      // Add the new data to the buffer
      this.packetBuffer = Buffer.concat([this.packetBuffer, chunk]);
    } else {
      this.packetBuffer = Buffer.concat([chunk]);
    }

    while (this.packetBuffer.length > 4) {
      const packetLength = this.packetBuffer[3] + 7;
      if (this.packetBuffer.length >= packetLength) {
        const packet = PrinterPacket.fromBytes(
          this.packetBuffer.subarray(0, packetLength)
        );
        debugLog('Received packet!', packet.type, packet.data);
        packets.push(packet);
        this.packetBuffer = this.packetBuffer.subarray(packetLength);
      }
    }

    return packets;
  };
  print = async (sharpImage, { density }) => {
    await this.setLabelDensity(density);
    await this.setLabelType(1);
    await this.startPrint();
    await this.startPagePrint();

    const metadata = await sharpImage.metadata();
    await this.setDimensions(metadata.width, metadata.height);

    const packets = await getImagePackets(sharpImage);
    packets.forEach((packet) => {
      this.transport.write(packet.toBytes());
    });

    // Wait for all data to be transmitted
    await this.transport.drain();
    await this.endPagePrint();

    // Check the status until completed
    for (let i = 0; i < 5; i++) {
      const status = await this.getPrintStatus();

      debugLog('Print progress:', status);

      if (status.progress1 === 100 && status.progress2 === 100) {
        break;
      }

      await wait(500);
    }

    await this.endPrint();
  };
  getPrintStatus = async () => {
    const { data } = await this._sendPacket(
      RequestCode.GET_PRINT_STATUS,
      [0x01],
      { responseOffset: 16 }
    );
    // >HBB
    const page = data.readUInt16BE(0);
    const progress1 = data.readInt8(2);
    const progress2 = data.readInt8(3);

    return { page, progress1, progress2 };
  };
  getInfo = async (key) => {
    const { data } = await this._sendPacket(RequestCode.GET_INFO, [key], {
      responseOffset: key,
    });

    switch (key) {
      case InfoCode.DEVICE_SERIAL: {
        return data.toString('utf-8');
      }
      case InfoCode.SOFTWARE_VERSION:
      case InfoCode.HARDWARE_VERSION: {
        const major = data.readUInt8(0);
        const minor = data.readUInt8(1);

        return `${major}.${minor}`;
      }
      case InfoCode.DEVICE_TYPE: {
        return data.readUInt16BE(0);
      }
      default: {
        return data.readUInt8(0);
      }
    }
  };
  getHeartbeat = async () => {
    const { data } = await this._sendPacket(RequestCode.GET_HEART_BEAT, [0x01]);

    let closingState = null;
    let powerLevel = null;
    let paperState = null;
    let rfidReadState = null;

    switch (data.length) {
      case 20: {
        paperState = data[18];
        rfidReadState = data[19];
        break;
      }
      case 13: {
        closingState = data[9];
        powerLevel = data[10];
        paperState = data[11];
        rfidReadState = data[12];
        break;
      }
      case 19: {
        closingState = data[15];
        powerLevel = data[16];
        paperState = data[17];
        rfidReadState = data[18];
        break;
      }
      case 10: {
        closingState = data[8];
        powerLevel = data[9];
        rfidReadState = data[8];
        break;
      }
      case 9: {
        closingState = data[8];
        break;
      }
    }

    return {
      closingState,
      powerLevel,
      paperState,
      rfidReadState,
    };
  };
  getRFID = async () => {
    const { data } = await this._sendPacket(RequestCode.GET_RFID, [0x01]);

    if (data[0] == 0) return null;

    let uuid = data.subarray(0, 8).toString('hex');
    let idx = 8;

    const barcodeLength = data[idx];
    idx += 1;
    const barcode = data.subarray(idx, idx + barcodeLength).toString('utf-8');

    idx += barcodeLength;
    const serialLength = data[idx];
    idx += 1;
    const serial = data.subarray(idx, idx + serialLength).toString('utf-8');

    idx += serialLength;

    const remainder = data.subarray(idx);
    // >HHB
    const totalLength = remainder.readUInt16BE(0);
    const usedLength = remainder.readUInt16BE(2);
    const type = remainder.readInt8(4);

    return {
      uuid,
      barcode,
      serial,
      totalLength,
      usedLength,
      type,
    };
  };
  setLabelType = async (type) => {
    assert(type >= 1 && type <= 3);
    const result = await this._sendPacket(RequestCode.SET_LABEL_TYPE, [type], {
      responseOffset: 16,
    });

    return Boolean(result.data[0]);
  };
  setLabelDensity = async (density) => {
    assert(
      density >= 1 && density <= 5,
      `Invalid density range; expected 1 - 5 but got ${density}`
    );
    const result = await this._sendPacket(
      RequestCode.SET_LABEL_DENSITY,
      [density],
      { responseOffset: 16 }
    );

    return Boolean(result.data[0]);
  };
  startPrint = async () => {
    const result = await this._sendPacket(RequestCode.START_PRINT, [0x01]);

    return Boolean(result.data[0]);
  };
  endPrint = async () => {
    const result = await this._sendPacket(RequestCode.END_PRINT, [0x01]);

    return Boolean(result.data[0]);
  };
  startPagePrint = async () => {
    const result = await this._sendPacket(RequestCode.START_PAGE_PRINT, [0x01]);

    return Boolean(result.data[0]);
  };
  endPagePrint = async () => {
    const result = await this._sendPacket(RequestCode.END_PAGE_PRINT, [0x01]);

    return Boolean(result.data[0]);
  };
  allowPrintClear = async () => {
    const result = await this._sendPacket(
      RequestCode.ALLOW_PRINT_CLEAR,
      [0x01],
      { responseOffset: 16 }
    );

    return Boolean(result.data[0]);
  };
  setDimensions = async (width, height) => {
    // >HH
    const data = Buffer.alloc(4);
    data.writeUInt16BE(height, 0);
    data.writeUInt16BE(width, 2);
    const result = await this._sendPacket(RequestCode.SET_DIMENSION, data);

    return Boolean(result.data[0]);
  };
}

export async function getImagePackets(sharpImage) {
  const packets = [];
  const { data, info } = await sharpImage
    .greyscale()
    .negate()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixelArray = new Uint8ClampedArray(data.buffer);
  const width = info.width;
  const height = info.height;

  if (width % 8 !== 0) {
    warnLog('Image width not a multiple of 8');
  }

  debugLog('Image info:', info);

  for (let y = 0; y < height; y++) {
    const colIndex = y * width;
    const pixels = pixelArray.subarray(colIndex, colIndex + width);

    let bits = '';
    let bytes = [];

    pixels.forEach((pixel) => {
      bits += pixel > 0 ? '1' : '0';

      if (bits.length === 8) {
        bytes.push(parseInt(bits, 2));
        bits = '';
      }
    });

    const lineData = Buffer.from(bytes);
    const header = Buffer.alloc(6);
    header.writeUInt16BE(y, 0);
    header.writeUInt8(0, 2);
    header.writeUInt8(0, 3);
    header.writeUInt16BE(1, 4);

    packets.push(
      new PrinterPacket(
        RequestCode.IMAGE_DATA,
        Buffer.concat([header, lineData])
      )
    );
  }

  return packets;
}
