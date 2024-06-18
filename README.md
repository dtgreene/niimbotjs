## NiimbotJS

A Node.js library for printing with the Niimbot series of label printers.

Currently, only printing over USB is supported.

This project is largely a port of [kjy00302/niimprint](https://github.com/kjy00302/niimprint) and [AndBondStyle/niimprint](https://github.com/AndBondStyle/niimprint) so big thanks to them.

## Usage

Images are handled using the [sharp](https://sharp.pixelplumbing.com/) library.  As long as your image is supported by sharp, it should work.

### CLI

The easiest way to just start printing is via npx:

```sh
npx niimbotjs my_image.png
```

```
Usage: niimbot [options] <image>

Printer client for Niimbot printers over USB

Arguments:
  image                    path of the image to print

Options:
  -m, --model <model>      niimbot model (choices: "b1", "b18", "b21", "d11", "d110", default: "b1")
  -d, --density <density>  print density (default: "5")
  --debug                  enable debug logging
  -p, --path <path>        serial path of the printer
  -h, --help               display help for command
```

### Package

You can also add the package to your project and print that way:

```
npm install niimbotjs
```

```js
import { PrinterClient } from 'niimbotjs';
import sharp from 'sharp';

const client = new PrinterClient();
const image = sharp('my_image.png');

try {
  await client.open();
  await client.print(image, { density: 5 });
} catch (error) {
  console.error(error);
}

client.close();
```

## Development

If you're doing your own development on the Niimbot printers, checkout [niimbotjs-tools](https://github.com/dtgreene/niimbotjs-tools)
