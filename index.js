import { Option, program } from 'commander';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert';
import loglevel from 'loglevel';
import sharp from 'sharp';

import { PrinterClient } from './lib/printer.js';
import { SerialTransport } from './lib/transport.js';
import { PrinterPacket } from './lib/packet.js';

program
  .name('niimbot')
  .description('Printer client for Niimbot printers over USB');

program
  .command('print')
  .description('Prints an image')
  .argument('<image>', 'path of the image to print')
  .addOption(
    new Option('-m, --model <model>', 'niimbot model')
      .choices(['b1', 'b18', 'b21', 'd11', 'd110'])
      .default('b1')
  )
  .addOption(
    new Option('-d, --density <density>', 'print density')
      .argParser(parseInt)
      .default('5')
  )
  .option('--debug', 'enable debug logging')
  .option('-p, --path <path>', 'serial path of the printer')
  .action(async (args, { model, density, path, debug }) => {
    const imagePath = resolve(process.cwd(), args);

    assert(existsSync(imagePath), 'File does not exist');

    const sharpImage = sharp(imagePath);
    const metadata = await sharpImage.metadata();
    const maxWidth = ['b1', 'b18', 'b21'].includes(model) ? 384 : 96;

    assert(
      metadata.width <= maxWidth,
      `Image width incompatible with ${model} model`
    );

    let densityOverride = density;

    if (['b18', 'd11', 'd110'].includes(model) && density > 5) {
      loglevel.warn(`Overriding density to 3 due to model ${model} limits`);
      densityOverride = 3;
    }

    if (debug) {
      loglevel.setDefaultLevel('DEBUG');
    }

    const client = new PrinterClient();

    try {
      await client.open(path);
      await wait(1_000);

      loglevel.debug('Beginning print');

      // await client.getPrintStatus();
      await client.print(sharpImage, density);
    } catch (error) {
      loglevel.error(error);
    }

    client.close();
  });

function wait(time = 0) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

program.parse();
