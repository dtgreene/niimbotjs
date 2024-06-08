import { SerialPort } from 'serialport';
import assert from 'node:assert/strict';
import loglevel from 'loglevel';

import { PrinterPacket } from './packet.js';

const SERIAL_VENDOR_ID = '3513';
const SERIAL_PRODUCT_ID = '0002';
const SERIAL_MANUFACTURER = 'NIIMBOT';
const SERIAL_BAUD_RATE = 115_200;
const PACKET_VALUE_ERROR_CODE = 219;
const PACKET_RESPONSE_TIMEOUT = 1_000;
const PACKET_READ_INTERVAL = 100;
const PACKET_READ_COUNT = 10;

const InfoCode = {
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

const RequestCode = {
  GET_INFO: 64, // 0x40
  GET_RFID: 26, // 0x1A
  GET_HEART_BEAT: 220, // 0xDC
  SET_LABEL_TYPE: 35, // 0x23
  SET_LABEL_DENSITY: 33, // 0x21
  START_PRINT: 1, // 0x01
  END_PRINT: 243, // 0xF3
  START_PAGE_PRINT: 3, // 0x03
  END_PAGE_PRINT: 227, // 0xE3
  ALLOW_PRINT_CLEAR: 32, // 0x20
  SET_DIMENSION: 19, // 0x13
  SET_QUANTITY: 21, // 0x15
  GET_PRINT_STATUS: 163, // 0xA3
  IMAGE_DATA: 133, // 0x85
};

export class PrinterClient {
  port = null;
  packetBuffer = Buffer.alloc(0);
  open = async (manualPath) => {
    const printer = await getPrintDevice(manualPath);
    assert(
      printer,
      `No device found at path ${manualPath || '(auto detected)'}`
    );

    return new Promise((resolve, reject) => {
      loglevel.debug(`Connecting to ${printer.path}...`);

      const portOptions = { path: printer.path, baudRate: SERIAL_BAUD_RATE };
      const connectCallback = (error) => {
        if (error) {
          const errorMessage = error instanceof Error ? error.message : error;
          reject(`Connection to ${printer.path} failed; ${errorMessage}`);
        } else {
          loglevel.debug('Connection success!');
          resolve();
        }
      };

      this.port = new SerialPort(portOptions, connectCallback);
      this.port.on('close', this.onPortClose);
      this.port.on('data', this.onData);
    });
  };
  close = () => {
    this.port.close();
  };
  sendPacket = (type, data, responseOffset = 1) => {
    if (this.packetResolve) {
      throw new Error(
        `Attempted to send packet while waiting on previous response; packet type ${type}`
      );
    }

    return new Promise((resolve, reject) => {
      loglevel.debug(`Sending packet type ${type}`);

      const packet = new PrinterPacket(type, data);
      const responseCode = responseOffset + type;
      const responseTimeout = setTimeout(
        () => reject(`Packet read timed out; packet type ${type}`),
        PACKET_RESPONSE_TIMEOUT
      );

      this.packetResolve = (packet) => {
        assert(packet.type !== PACKET_VALUE_ERROR_CODE, 'Received value error');
        assert(packet.type !== 0, 'Received unknown packet type');

        if (packet.type === responseCode) {
          clearTimeout(responseTimeout);
          resolve(packet);

          this.packetResolve = null;
        } else {
          loglevel.error(
            `Received unexpected packet; packet type ${packet.type}`
          );
        }
      };
      this.port.write(packet.toBytes());
    });
  };
  onData = (chunk) => {
    loglevel.debug('Received data');

    // Add the new data to the buffer
    this.packetBuffer = Buffer.concat([this.packetBuffer, chunk]);

    if (this.packetBuffer.length > 4) {
      const packetLength = this.packetBuffer[3] + 7;
      if (this.packetBuffer.length >= packetLength) {
        const packet = PrinterPacket.fromBytes(
          this.packetBuffer.subarray(0, packetLength)
        );

        this.packetBuffer = Buffer.alloc(0);
        if (this.packetResolve) {
          this.packetResolve(packet);
        } else {
          loglevel.debug(
            `Received packet without a listen resolver; packet type ${packet.type}`
          );
        }
      }
    }
  };
  onPortClose = () => {
    // assert(!this.isPrinting, 'Port was closed during print');
  };
  print = async (sharpImage, density) => {
    await this.setLabelDensity(density);
    await this.setLabelType(1);
    await this.startPrint();
    await this.startPagePrint();

    const metadata = await sharpImage.metadata();
    await this.setDimensions(metadata.width, metadata.height);

    const packets = await getImagePackets(sharpImage);
    packets.forEach((packet) => {
      this.port.write(packet.toBytes());
    });

    await this.endPagePrint();

    for (let i = 0; i < 10; i++) {
      const status = await this.getPrintStatus();

      if (status.progress1 === 100 && status.progress2 === 100) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    await this.endPrint();
  };
  getPrintStatus = async () => {
    const { data } = await this.sendPacket(
      RequestCode.GET_PRINT_STATUS,
      [0x01],
      16
    );
    // >HBB
    const page = data.readUInt16BE(0);
    const progress1 = data.readInt8(2);
    const progress2 = data.readInt8(3);

    return { page, progress1, progress2 };
  };
  getInfo = async (key) => {
    const { data } = await this.sendPacket(RequestCode.GET_INFO, [key], key);

    switch (key) {
      case InfoCode.DEVICE_SERIAL: {
        return data.toString('hex');
      }
      case InfoCode.SOFTWARE_VERSION: {
        return bytesToInt(data) / 100;
      }
      case InfoCode.HARDWARE_VERSION: {
        return bytesToInt(data) / 100;
      }
      default: {
        return bytesToInt(data);
      }
    }
  };
  getHeartbeat = async () => {
    const { data } = await this.sendPacket(RequestCode.GET_HEART_BEAT, [0x01]);

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
    const { data } = await this.sendPacket(RequestCode.GET_RFID, [0x01]);

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
    const result = await this.sendPacket(
      RequestCode.SET_LABEL_TYPE,
      [type],
      16
    );

    return Boolean(result.data[0]);
  };
  setLabelDensity = async (density) => {
    assert(density >= 1 && density <= 5);
    const result = await this.sendPacket(
      RequestCode.SET_LABEL_DENSITY,
      [density],
      16
    );

    return Boolean(result.data[0]);
  };
  startPrint = async () => {
    const result = await this.sendPacket(RequestCode.START_PRINT, [0x01]);

    return Boolean(result.data[0]);
  };
  endPrint = async () => {
    const result = await this.sendPacket(RequestCode.END_PRINT, [0x01]);

    return Boolean(result.data[0]);
  };
  startPagePrint = async () => {
    const result = await this.sendPacket(RequestCode.START_PAGE_PRINT, [0x01]);

    return Boolean(result.data[0]);
  };
  endPagePrint = async () => {
    const result = await this.sendPacket(RequestCode.END_PAGE_PRINT, [0x01]);

    return Boolean(result.data[0]);
  };
  allowPrintClear = async () => {
    const result = await this.sendPacket(
      RequestCode.ALLOW_PRINT_CLEAR,
      [0x01],
      16
    );

    return Boolean(result.data[0]);
  };
  setDimensions = async (width, height) => {
    // >HH
    const data = Buffer.alloc(4);
    data.writeUInt16BE(width, 0);
    data.writeUInt16BE(height, 2);
    const result = await this.sendPacket(RequestCode.SET_DIMENSION, data);

    return Boolean(result.data[0]);
  };
  setQuantity = async (quantity) => {
    // >H
    const data = Buffer.alloc(2);
    data.writeUInt16BE(quantity, 0);
    const result = await this.sendPacket(RequestCode.SET_QUANTITY, data);

    return Boolean(result.data[0]);
  };
}

async function getImagePackets(sharpImage) {
  const packets = [];
  const { data, info } = await sharpImage
    .greyscale()
    .negate()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixelArray = new Uint8ClampedArray(data.buffer);

  for (let y = 0; y < info.height; y++) {
    const rowIndex = y * info.width;
    const rowSlice = pixelArray.slice(rowIndex, rowIndex + info.width);
    const pixelString = rowSlice.reduce(
      (result, value) => result + Math.min(value, 1),
      ''
    );
    const pixelBufferSize = Math.ceil(info.width / 8);
    const pixelBuffer = bigIntToBytes(
      BigInt(parseInt(pixelString, 2)),
      pixelBufferSize
    );

    // >H3BB
    const header = Buffer.alloc(6);
    header.writeUInt16BE(y, 0);
    header.writeUInt8(0, 2);
    header.writeUInt8(0, 3);
    header.writeUInt8(0, 4);
    header.writeUInt8(0, 5);

    packets.push(
      new PrinterPacket(
        RequestCode.IMAGE_DATA,
        Buffer.concat([header, pixelBuffer])
      )
    );
  }

  return packets;
}

function bigIntToBytes(num, size) {
  // From bigint-buffer
  // https://github.com/no2chem/bigint-buffer/blob/master/src/index.ts#L78
  const hex = num.toString(16);
  return Buffer.from(hex.padStart(size * 2, '0').slice(0, size * 2), 'hex');
}

function bytesToInt(bytes) {
  let value = 0;
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
  }
  return value;
}

async function getPrintDevice(path) {
  const devices = await SerialPort.list();

  if (path) {
    return devices.find((device) => device.path === path);
  }

  const isWindows = process.platform === 'win32';
  const matchFunc = isWindows ? matchWindowsPrinter : matchDefaultPrinter;

  return devices.find(matchFunc);
}

function matchWindowsPrinter(device) {
  return (
    device.vendorId === SERIAL_VENDOR_ID &&
    device.productId === SERIAL_PRODUCT_ID
  );
}

function matchDefaultPrinter(device) {
  return (
    device.manufacturer === SERIAL_MANUFACTURER &&
    device.productId === SERIAL_PRODUCT_ID
  );
}
