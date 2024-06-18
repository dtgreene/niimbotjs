import assert from 'node:assert/strict';
import sharp from 'sharp';

import { Packet } from './packet.js';
import { SerialTransport } from './serial.js';
import { wait, debugLog, warnLog } from './utils.js';

const PACKET_TYPE_VALUE_ERROR = 219;
const PACKET_TYPE_UNIMPLEMENTED_ERROR = 0;
const PACKET_READ_INTERVAL = 100;
const PACKET_READ_COUNT = 10;

export enum InfoCode {
  DENSITY = 1,
  LABEL_TYPE = 3,
  AUTO_SHUTDOWN_TIME = 7,
  DEVICE_TYPE = 8,
  SOFTWARE_VERSION = 9,
  BATTERY = 10,
  DEVICE_SERIAL = 11,
  HARDWARE_VERSION = 12,
}

export enum RequestCode {
  START_PRINT = 1,
  START_PAGE_PRINT = 3,
  SET_DIMENSION = 19,
  GET_RFID = 26,
  SET_LABEL_DENSITY = 33,
  SET_LABEL_TYPE = 35,
  GET_INFO = 64,
  SET_AUDIO_SETTING = 88,
  IMAGE_DATA_META = 132,
  IMAGE_DATA = 133,
  CALIBRATE_LABEL = 142,
  GET_PRINT_STATUS = 163,
  GET_HEART_BEAT = 220,
  END_PAGE_PRINT = 227,
  END_PRINT = 243,
}

export enum LabelType {
  GAP = 1,
  BLACK = 2,
  TRANSPARENT = 5,
}

export class PrinterClient {
  private packetBuffer: Buffer | null = null;
  private serial = new SerialTransport();
  open = (path?: string) => {
    return this.serial.open(path);
  };
  close = () => {
    this.serial.close();
  };
  private sendPacket = async (
    type: number,
    data: Buffer | number[] = [1],
    responseOffset = 1
  ) => {
    debugLog('Writing packet!', type, data);

    const buffer = data instanceof Buffer ? data : Buffer.from(data);
    const packet = new Packet(type, buffer);
    const responseCode = type + responseOffset;

    await this.serial.write(packet.toBytes());
    const response = await this.receivePacket(responseCode);

    if (response) {
      return response;
    } else {
      throw new Error('Expected response was never received');
    }
  };
  private receivePacket = async (responseCode: number) => {
    for (let i = 0; i < PACKET_READ_COUNT; i++) {
      const packets = this.processChunk();

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
  private processChunk = () => {
    const packets: Packet[] = [];
    const chunk = this.serial.read();

    if (!chunk) return packets;

    debugLog('Received data!', chunk);

    if (this.packetBuffer) {
      // Add the new data to the buffer
      this.packetBuffer = Buffer.concat([this.packetBuffer, chunk]);
    } else {
      this.packetBuffer = Buffer.concat([chunk]);
    }

    while (this.packetBuffer.length > 4) {
      const packetLength = this.packetBuffer[3] + 7;
      if (this.packetBuffer.length >= packetLength) {
        const packet = Packet.fromBytes(
          this.packetBuffer.subarray(0, packetLength)
        );
        debugLog('Received packet!', packet.type, packet.data);
        packets.push(packet);
        this.packetBuffer = this.packetBuffer.subarray(packetLength);
      }
    }

    return packets;
  };
  print = async (sharpImage: sharp.Sharp, { density }: { density: number }) => {
    await this.setLabelDensity(density);
    await this.setLabelType(1);
    await this.getInfo(InfoCode.DEVICE_TYPE);
    await this.startPrint();
    await this.startPagePrint();

    const metadata = await sharpImage.metadata();
    await this.setDimensions(metadata.width, metadata.height);

    const imageData = await prepareImage(sharpImage);
    for (let i = 0; i < imageData.length; i++) {
      await this.serial.write(imageData[i]);
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
    const { data } = await this.sendPacket(
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
  getInfo = async (key: InfoCode) => {
    const { data } = await this.sendPacket(RequestCode.GET_INFO, [key], key);

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
  getHeartBeat = async (variant: 4 | 3 | 2 | 1 = 4) => {
    assert(
      variant >= 1 && variant <= 4,
      `Invalid variant range; expected 1 - 4 but got ${variant}`
    );
    const offsets = {
      4: -3,
      3: 2,
      2: 3,
      1: 1,
    };
    const { data } = await this.sendPacket(
      RequestCode.GET_HEART_BEAT,
      [variant],
      offsets[variant]
    );

    let doorOpen: boolean | null = null;
    let hasPaper: boolean | null = null;

    switch (variant) {
      case 1: {
        doorOpen = Boolean(data[9]);
        hasPaper = Boolean(data[12]);
        break;
      }
      case 4: {
        doorOpen = Boolean(data[4]);
        hasPaper = Boolean(data[6]);
        break;
      }
    }

    return { doorOpen, hasPaper };
  };
  getRFID = async () => {
    const { data } = await this.sendPacket(RequestCode.GET_RFID);

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
  setLabelType = (type: number) => {
    assert(type >= 1 && type <= 3);
    return this.sendPacket(RequestCode.SET_LABEL_TYPE, [type], 16);
  };
  setLabelDensity = (density: number) => {
    assert(
      density >= 1 && density <= 5,
      `Invalid density range; expected 1 - 5 but got ${density}`
    );
    return this.sendPacket(RequestCode.SET_LABEL_DENSITY, [density], 16);
  };
  startPrint = () => {
    return this.sendPacket(RequestCode.START_PRINT);
  };
  endPrint = () => {
    return this.sendPacket(RequestCode.END_PRINT);
  };
  startPagePrint = () => {
    return this.sendPacket(RequestCode.START_PAGE_PRINT);
  };
  endPagePrint = () => {
    return this.sendPacket(RequestCode.END_PAGE_PRINT);
  };
  setDimensions = (width: number, height: number) => {
    // >HH
    const data = Buffer.alloc(4);
    data.writeUInt16BE(height, 0);
    data.writeUInt16BE(width, 2);

    return this.sendPacket(RequestCode.SET_DIMENSION, data);
  };
  setPowerSound = (enabled: boolean) => {
    const data = [1, 2, enabled ? 1 : 0];
    return this.sendPacket(RequestCode.SET_AUDIO_SETTING, data);
  };
  setBluetoothSound = (enabled: boolean) => {
    const data = [1, 1, enabled ? 1 : 0];
    return this.sendPacket(RequestCode.SET_AUDIO_SETTING, data);
  };
  calibrateLabel = (label: LabelType) => {
    return this.sendPacket(RequestCode.CALIBRATE_LABEL, [label]);
  };
}

export async function prepareImage(sharpImage: sharp.Sharp) {
  const imageData: Buffer[] = [];
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
    let bytes: number[] = [];
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

    const packet = new Packet(
      RequestCode.IMAGE_DATA,
      Buffer.concat([header, lineData])
    );

    imageData.push(packet.toBytes());
  }

  return imageData;
}
