## NiimbotJS

A NodeJS package and CLI for printing with Niimbot label printers.

Largely a port of [kjy00302/niimprint](https://github.com/kjy00302/niimprint) and [AndBondStyle/niimprint](https://github.com/AndBondStyle/niimprint) so big thanks to them.

| Method  | Example Response |
| ------------- | ------------- |
| **getPrintStatus**()  | `{ page: 0, progress1: 0, progress2: 0 }`  |
| **getInfo**(InfoCode.DENSITY)  | `5`  |
| **getInfo**(InfoCode.LABEL_TYPE)  | `1`  |
| **getInfo**(InfoCode.AUTO_SHUTDOWN_TIME)  | `3`  |
| **getInfo**(InfoCode.DEVICE_TYPE)  | `4096`  |
| **getInfo**(InfoCode.SOFTWARE_VERSION)  | `5.14`  |
| **getInfo**(InfoCode.BATTERY)  | `4`  |
| **getInfo**(InfoCode.DEVICE_SERIAL)  | `G113130530`  |
| **getInfo**(InfoCode.HARDWARE_VERSION)  | `5.10`  |
| **getHeartbeat**()  | `{ doorOpen: false, hasPaper: true }`  |
| **getRFID**()  | `{ uuid: '881db6aaeb960000', barcode: '10262260', serial: 'PZ1G103317007453', totalLength: 276, usedLength: 162, type: 1 }`  |

