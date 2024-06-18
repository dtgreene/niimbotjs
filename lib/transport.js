import assert from 'node:assert';
import { promisify } from 'node:util';
import { SerialPort } from 'serialport';

import { debugLog } from './utils.js';

const SERIAL_VENDOR_ID = '3513';
const SERIAL_PRODUCT_ID = '0002';
const SERIAL_MANUFACTURER = 'NIIMBOT';
const SERIAL_BAUD_RATE = 115_200;

export class SerialTransport {
  _port = null;
  _handlePortClose = () => {
    this._port = null;
  };
  open = async (path) => {
    if (this.isOpen()) return;

    const printer = await getPrintDevice(path);
    assert(printer, `Could not find Niimbot: ${path || '(auto detected)'}`);

    return new Promise((resolve, reject) => {
      debugLog(`Connecting to ${printer.path}...`);

      const portOptions = { path: printer.path, baudRate: SERIAL_BAUD_RATE };
      const connectCallback = (error) => {
        if (error) {
          const errorMessage = error instanceof Error ? error.message : error;
          reject(`Connection to ${printer.path} failed; ${errorMessage}`);
        } else {
          debugLog('Connection success!');
          resolve();
        }
      };

      this._port = new SerialPort(portOptions, connectCallback);
      this._port.on('close', this._handlePortClose);
    });
  };
  close = () => {
    if (this.isOpen()) {
      this._port.close();
      this._port = null;
    }
  };
  isOpen = () => {
    return Boolean(this._port?.isOpen);
  };
  read = (size) => {
    assert(this.isOpen(), 'Transport not open');
    return this._port.read(size);
  };
  write = (data) => {
    assert(this.isOpen(), 'Transport not open');
    debugLog('Writing data!', data);
    this._port.write(data);

    return this.drain();
  };
  drain = () => {
    assert(this.isOpen(), 'Transport not open');
    return promisify(this._port.drain).call(this._port);
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
