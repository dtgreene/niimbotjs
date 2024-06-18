import assert from 'node:assert/strict';

import { PrinterPacket, createPacketBytes } from './packet.js';
import { SerialTransport } from './transport.js';
import { wait, debugLog, warnLog } from './utils.js';

const PACKET_TYPE_VALUE_ERROR = 219;
const PACKET_TYPE_UNIMPLEMENTED_ERROR = 0;
const PACKET_READ_INTERVAL = 100;
const PACKET_READ_COUNT = 10;

export const InfoCode = {
  DENSITY: 1,
  LABEL_TYPE: 3,
  AUTO_SHUTDOWN_TIME: 7,
  DEVICE_TYPE: 8,
  SOFTWARE_VERSION: 9,
  BATTERY: 10,
  DEVICE_SERIAL: 11,
  HARDWARE_VERSION: 12,
};

export const RequestCode = {
  START_PRINT: 1,
  START_PAGE_PRINT: 3,
  SET_DIMENSION: 19,
  GET_RFID: 26,
  SET_LABEL_DENSITY: 33,
  SET_LABEL_TYPE: 35,
  GET_INFO: 64,
  IMAGE_DATA_META: 132,
  IMAGE_DATA: 133,
  GET_PRINT_STATUS: 163,
  GET_HEART_BEAT: 220,
  END_PAGE_PRINT: 227,
  END_PRINT: 243,
};

export class PrinterClient {
  _packetBuffer = null;
  _transport = new SerialTransport();
  open = (path) => {
    return this._transport.open(path);
  };
  close = () => {
    this._transport.close();
  };
  _sendPacket = async (type, data = [1], responseOffset = 1) => {
    debugLog('Writing packet!', type, data);
    const bytes = createPacketBytes(type, data);
    const responseCode = type + responseOffset;

    await this._transport.write(bytes);
    const response = await this._receivePacket(responseCode);

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
            warnLog(
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
    const chunk = this._transport.read();

    if (!chunk) return packets;

    debugLog('Received data!', chunk);

    if (this._packetBuffer) {
      // Add the new data to the buffer
      this._packetBuffer = Buffer.concat([this._packetBuffer, chunk]);
    } else {
      this._packetBuffer = Buffer.concat([chunk]);
    }

    while (this._packetBuffer.length > 4) {
      const packetLength = this._packetBuffer[3] + 7;
      if (this._packetBuffer.length >= packetLength) {
        const packet = PrinterPacket.fromBytes(
          this._packetBuffer.subarray(0, packetLength)
        );
        debugLog('Received packet!', packet.type, packet.data);
        packets.push(packet);
        this._packetBuffer = this._packetBuffer.subarray(packetLength);
      }
    }

    return packets;
  };
  print = async (sharpImage, { density }) => {
    await this.setLabelDensity(density);
    await this.setLabelType(1);
    await this.getInfo(InfoCode.DEVICE_TYPE);
    await this.startPrint();
    await this.startPagePrint();

    const metadata = await sharpImage.metadata();
    await this.setDimensions(metadata.width, metadata.height);

    const imageData = await prepareImage(sharpImage);
    for (let i = 0; i < imageData.length; i++) {
      await this._transport.write(imageData[i]);
    }

    // Wait for all data to be transmitted
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
      [1],
      16
    );
    // >HBB
    const page = data.readUInt16BE(0);
    const progress1 = data.readInt8(2);
    const progress2 = data.readInt8(3);

    return { page, progress1, progress2 };
  };
  getInfo = async (key) => {
    const { data } = await this._sendPacket(RequestCode.GET_INFO, [key], key);

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
    const { data } = await this._sendPacket(
      RequestCode.GET_HEART_BEAT,
      [4],
      -3
    );

    let closingState = null;
    let powerLevel = null;
    let paperState = null;
    let rfidReadState = null;

    // const doorOpen = Boolean(data[4]);

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
    const { data } = await this._sendPacket(RequestCode.GET_RFID);

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
    const result = await this._sendPacket(
      RequestCode.SET_LABEL_TYPE,
      [type],
      16
    );

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
      16
    );

    return Boolean(result.data[0]);
  };
  startPrint = async () => {
    const result = await this._sendPacket(RequestCode.START_PRINT);

    return Boolean(result.data[0]);
  };
  endPrint = async () => {
    const result = await this._sendPacket(RequestCode.END_PRINT);

    return Boolean(result.data[0]);
  };
  startPagePrint = async () => {
    const result = await this._sendPacket(RequestCode.START_PAGE_PRINT);

    return Boolean(result.data[0]);
  };
  endPagePrint = async () => {
    const result = await this._sendPacket(RequestCode.END_PAGE_PRINT);

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

export async function prepareImage(sharpImage) {
  const imageData = [];
  const { data, info } = await sharpImage
    .greyscale()
    .negate()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixelArray = new Uint8ClampedArray(data.buffer);
  const width = info.width;
  const height = info.height;
  const midPoint = Math.floor(width / 2);

  if (width % 8 !== 0) {
    warnLog('Image width not a multiple of 8');
  }

  debugLog('Image info:', info);

  for (let y = 0; y < height; y++) {
    const colIndex = y * width;
    const pixels = pixelArray.subarray(colIndex, colIndex + width);

    let bits = '';
    let bytes = [];
    let left = 0;
    let right = 0;

    pixels.forEach((pixel, index) => {
      const bit = pixel > 0 ? '1' : '0';

      if (bit === '1') {
        if (index < midPoint) {
          left++;
        } else {
          right++;
        }
      }

      bits += bit;

      if (bits.length === 8) {
        bytes.push(parseInt(bits, 2));
        bits = '';
      }
    });

    const lineData = Buffer.from(bytes);
    const header = Buffer.alloc(6);
    // The current row within the image
    header.writeUInt16BE(y, 0);
    // Relative to the middle, number of pixels to the left
    header.writeUInt8(midPoint - left, 2);
    // Relative to the middle, number of pixels to the right
    header.writeUInt8(midPoint - right, 3);
    // How many times to repeat this row
    header.writeUInt16BE(1, 4);

    imageData.push(
      createPacketBytes(
        RequestCode.IMAGE_DATA,
        Buffer.concat([header, lineData])
      )
    );
  }

  return imageData;
}
