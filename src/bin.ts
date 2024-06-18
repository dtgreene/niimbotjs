#!/usr/bin/env node

import { Option, program } from 'commander';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert';
import loglevel from 'loglevel';
import sharp from 'sharp';

import { PrinterClient } from './lib/printer.js';
import { wait, errorLog, warnLog, infoLog } from './lib/utils.js';

program
  .name('niimbot')
  .description('Printer client for Niimbot printers over USB')
  .argument('<image>', 'path of the image to print')
  .addOption(
    new Option('-m, --model <model>', 'niimbot model')
      .choices(['b1', 'b18', 'b21', 'd11', 'd110'])
      .default('b1')
  )
  .option('-d, --density <density>', 'print density', '5')
  .option('--debug', 'enable debug logging')
  .option('-p, --path <path>', 'serial path of the printer')
  .action(async (args, { model, density, path, debug }) => {
    if (debug) {
      loglevel.setDefaultLevel('DEBUG');
    }

    const imagePath = resolve(process.cwd(), args);

    assert(existsSync(imagePath), `File does not exist: ${imagePath}`);

    const sharpImage = sharp(imagePath);
    const metadata = await sharpImage.metadata();
    const maxWidth = ['b1', 'b18', 'b21'].includes(model) ? 384 : 96;

    assert(
      metadata.width ?? 0 <= maxWidth,
      `Image width incompatible with ${model} model`
    );

    const options = {
      density: Number(density),
    };

    if (['b18', 'd11', 'd110'].includes(model) && options.density > 5) {
      warnLog(`Overriding density to 3 due to model ${model} limits`);
      options.density = 3;
    }

    const client = new PrinterClient();

    try {
      await client.open(path);
      await wait(1_000);

      infoLog('Starting print...');
      await client.print(sharpImage, options);
      infoLog('Print complete!');
    } catch (error) {
      errorLog(error);
    }

    client.close();
  });

program.parse();
