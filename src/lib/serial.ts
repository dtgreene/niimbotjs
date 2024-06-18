import assert from 'node:assert';
import { promisify } from 'node:util';
import { SerialPort } from 'serialport';

import { debugLog } from './utils.js';

const SERIAL_VENDOR_ID = '3513';
const SERIAL_PRODUCT_ID = '0002';
const SERIAL_MANUFACTURER = 'NIIMBOT';
const SERIAL_BAUD_RATE = 115_200;

export type SerialDevice = {
  path?: string;
  vendorId?: string;
  productId?: string;
  manufacturer?: string;
};

export class SerialTransport {
  private port: SerialPort | null = null;
  private handlePortClose = () => {
    this.port = null;
  };
  open = async (path?: string) => {
    if (this.isOpen()) return;

    const printer = await getPrintDevice(path);
    assert(printer, `Could not find Niimbot: ${path || '(auto detected)'}`);

    return new Promise<void>((resolve, reject) => {
      debugLog(`Connecting to ${printer.path}...`);

      const portOptions = { path: printer.path, baudRate: SERIAL_BAUD_RATE };
      const connectCallback = (error: Error | null) => {
        if (error) {
          const errorMessage = error instanceof Error ? error.message : error;
          reject(`Connection to ${printer.path} failed; ${errorMessage}`);
        } else {
          debugLog('Connection success!');
          resolve();
        }
      };

      this.port = new SerialPort(portOptions, connectCallback);
      this.port.on('close', this.handlePortClose);
    });
  };
  close = () => {
    if (this.port?.isOpen) {
      this.port.close();
      this.port = null;
    }
  };
  isOpen = () => {
    return Boolean(this.port?.isOpen);
  };
  read = (size?: number) => {
    assert(this.port?.isOpen, 'Transport not open');
    return this.port.read(size);
  };
  write = (data: Buffer) => {
    assert(this.port?.isOpen, 'Transport not open');
    debugLog('Writing data!', data);
    this.port.write(data);

    return promisify(this.port.drain).call(this.port);
  };
}

async function getPrintDevice(path?: string) {
  const devices: SerialDevice[] = await SerialPort.list();

  if (path) {
    return devices.find((device) => device.path === path);
  }

  const isWindows = process.platform === 'win32';
  const matchFunc = isWindows ? matchWindowsPrinter : matchDefaultPrinter;

  return devices.find(matchFunc);
}

function matchWindowsPrinter(device: SerialDevice) {
  return (
    device.vendorId === SERIAL_VENDOR_ID &&
    device.productId === SERIAL_PRODUCT_ID
  );
}

function matchDefaultPrinter(device: SerialDevice) {
  return (
    device.manufacturer === SERIAL_MANUFACTURER &&
    device.productId === SERIAL_PRODUCT_ID
  );
}
