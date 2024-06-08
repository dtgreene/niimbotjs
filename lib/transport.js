import assert from 'node:assert';
import loglevel from 'loglevel';
import { promisify } from 'node:util';
import { SerialPort } from 'serialport';

import { PrinterPacket } from './printer.js';

const SERIAL_VENDOR_ID = '3513';
const SERIAL_PRODUCT_ID = '0002';
const SERIAL_MANUFACTURER = 'NIIMBOT';
const SERIAL_BAUD_RATE = 115_200;
const PACKET_BUFFER_SIZE = 64 * 1024;

export class SerialTransport {
  port = null;
  buffer = Buffer.allocUnsafe(PACKET_BUFFER_SIZE);
  packetBuffer = [];
  _onPortClose = () => {
    this.port = null;
  };
  _onData = (chunk) => {
    loglevel.debug('Received data');

    // Add the new data to the buffer
    this.buffer = Buffer.concat([this.buffer, chunk]);

    while (this.buffer.length > 4) {
      const packetLength = this.buffer[3] + 7;
      if (this.buffer.length >= packetLength) {
        const packet = PrinterPacket.fromBytes(
          this.buffer.subarray(0, packetLength)
        );
        this.packetBuffer.push(packet);
        this.buffer = this.buffer.subarray(packetLength);
      }
    }
  };
  open = async (path) => {
    if (this.isOpen()) {
      loglevel.debug('Port is already open');
      return;
    }

    const printer = await getPrintDevice(path);
    assert(printer, `Could not find Niimbot: ${path || '(auto detected)'}`);

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
      this.port.on('close', this._onPortClose);
      this.port.on('data', this._onData);
    });
  };
  close = () => {
    if (this.isOpen()) {
      this.port.close();
      this.port = null;
    } else {
      loglevel.debug('Port is already closed');
    }
  };
  isOpen = () => {
    return Boolean(this.port?.isOpen);
  };
  read = (size) => {
    assert(this.isOpen(), 'Transport not open');
    return this.port.read(size);
  };
  write = (data) => {
    assert(this.isOpen(), 'Transport not open');
    this.port.write(data);
  };
  drain = () => {
    assert(this.isOpen(), 'Transport not open');
    return promisify(this.port.drain)();
  };
  flush = () => {
    assert(this.isOpen(), 'Transport not open');
    return promisify(this.port.flush)();
  };
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
