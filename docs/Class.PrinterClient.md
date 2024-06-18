[github-wiki-example](../wiki/Home) / PrinterClient

# Class: PrinterClient

## Constructors

### new PrinterClient()

> **new PrinterClient**(): [`PrinterClient`](../wiki/Class.PrinterClient)

#### Returns

[`PrinterClient`](../wiki/Class.PrinterClient)

## Properties

| Property | Modifier | Type | Default value |
| :------ | :------ | :------ | :------ |
| `packetBuffer` | `private` | `Buffer` | `null` |
| `serial` | `private` | [`SerialTransport`](../wiki/Class.SerialTransport) | `...` |

## Methods

### calibrateLabel()

> **calibrateLabel**(`label`): `Promise`\<[`Packet`](../wiki/Class.Packet)\>

#### Parameters

| Parameter | Type |
| :------ | :------ |
| `label` | [`LabelType`](../wiki/Enumeration.LabelType) |

#### Returns

`Promise`\<[`Packet`](../wiki/Class.Packet)\>

#### Source

lib/printer.ts:313

***

### close()

> **close**(): `void`

#### Returns

`void`

#### Source

lib/printer.ts:54

***

### endPagePrint()

> **endPagePrint**(): `Promise`\<[`Packet`](../wiki/Class.Packet)\>

#### Returns

`Promise`\<[`Packet`](../wiki/Class.Packet)\>

#### Source

lib/printer.ts:294

***

### endPrint()

> **endPrint**(): `Promise`\<[`Packet`](../wiki/Class.Packet)\>

#### Returns

`Promise`\<[`Packet`](../wiki/Class.Packet)\>

#### Source

lib/printer.ts:288

***

### getHeartBeat()

> **getHeartBeat**(`variant`): `Promise`\<`object`\>

#### Parameters

| Parameter | Type | Default value |
| :------ | :------ | :------ |
| `variant` | `1` \| `2` \| `3` \| `4` | `4` |

#### Returns

`Promise`\<`object`\>

| Member | Type |
| :------ | :------ |
| `doorOpen` | `boolean` |
| `hasPaper` | `boolean` |

#### Source

lib/printer.ts:205

***

### getInfo()

> **getInfo**(`key`): `Promise`\<`string` \| `number`\>

#### Parameters

| Parameter | Type |
| :------ | :------ |
| `key` | [`InfoCode`](../wiki/Enumeration.InfoCode) |

#### Returns

`Promise`\<`string` \| `number`\>

#### Source

lib/printer.ts:183

***

### getPrintStatus()

> **getPrintStatus**(): `Promise`\<`object`\>

#### Returns

`Promise`\<`object`\>

| Member | Type |
| :------ | :------ |
| `page` | `number` |
| `progress1` | `number` |
| `progress2` | `number` |

#### Source

lib/printer.ts:170

***

### getRFID()

> **getRFID**(): `Promise`\<`object`\>

#### Returns

`Promise`\<`object`\>

| Member | Type |
| :------ | :------ |
| `barcode` | `string` |
| `serial` | `string` |
| `totalLength` | `number` |
| `type` | `number` |
| `usedLength` | `number` |
| `uuid` | `string` |

#### Source

lib/printer.ts:240

***

### open()

> **open**(`path`?): `Promise`\<`void`\>

#### Parameters

| Parameter | Type |
| :------ | :------ |
| `path`? | `string` |

#### Returns

`Promise`\<`void`\>

#### Source

lib/printer.ts:51

***

### print()

> **print**(`sharpImage`, `__namedParameters`): `Promise`\<`void`\>

#### Parameters

| Parameter | Type |
| :------ | :------ |
| `sharpImage` | `Sharp` |
| `__namedParameters` | `object` |
| `__namedParameters.density` | `number` |

#### Returns

`Promise`\<`void`\>

#### Source

lib/printer.ts:137

***

### processChunk()

> `private` **processChunk**(): [`Packet`](../wiki/Class.Packet)[]

#### Returns

[`Packet`](../wiki/Class.Packet)[]

#### Source

lib/printer.ts:108

***

### receivePacket()

> `private` **receivePacket**(`responseCode`): `Promise`\<[`Packet`](../wiki/Class.Packet)\>

#### Parameters

| Parameter | Type |
| :------ | :------ |
| `responseCode` | `number` |

#### Returns

`Promise`\<[`Packet`](../wiki/Class.Packet)\>

#### Source

lib/printer.ts:77

***

### sendPacket()

> `private` **sendPacket**(`type`, `data`, `responseOffset`): `Promise`\<[`Packet`](../wiki/Class.Packet)\>

#### Parameters

| Parameter | Type | Default value |
| :------ | :------ | :------ |
| `type` | `number` | `undefined` |
| `data` | `number`[] \| `Buffer` | `undefined` |
| `responseOffset` | `number` | `1` |

#### Returns

`Promise`\<[`Packet`](../wiki/Class.Packet)\>

#### Source

lib/printer.ts:57

***

### setBluetoothSound()

> **setBluetoothSound**(`enabled`): `Promise`\<[`Packet`](../wiki/Class.Packet)\>

#### Parameters

| Parameter | Type |
| :------ | :------ |
| `enabled` | `boolean` |

#### Returns

`Promise`\<[`Packet`](../wiki/Class.Packet)\>

#### Source

lib/printer.ts:309

***

### setDimensions()

> **setDimensions**(`width`, `height`): `Promise`\<[`Packet`](../wiki/Class.Packet)\>

#### Parameters

| Parameter | Type |
| :------ | :------ |
| `width` | `number` |
| `height` | `number` |

#### Returns

`Promise`\<[`Packet`](../wiki/Class.Packet)\>

#### Source

lib/printer.ts:297

***

### setLabelDensity()

> **setLabelDensity**(`density`): `Promise`\<[`Packet`](../wiki/Class.Packet)\>

#### Parameters

| Parameter | Type |
| :------ | :------ |
| `density` | `number` |

#### Returns

`Promise`\<[`Packet`](../wiki/Class.Packet)\>

#### Source

lib/printer.ts:278

***

### setLabelType()

> **setLabelType**(`type`): `Promise`\<[`Packet`](../wiki/Class.Packet)\>

#### Parameters

| Parameter | Type |
| :------ | :------ |
| `type` | `number` |

#### Returns

`Promise`\<[`Packet`](../wiki/Class.Packet)\>

#### Source

lib/printer.ts:274

***

### setPowerSound()

> **setPowerSound**(`enabled`): `Promise`\<[`Packet`](../wiki/Class.Packet)\>

#### Parameters

| Parameter | Type |
| :------ | :------ |
| `enabled` | `boolean` |

#### Returns

`Promise`\<[`Packet`](../wiki/Class.Packet)\>

#### Source

lib/printer.ts:305

***

### startPagePrint()

> **startPagePrint**(): `Promise`\<[`Packet`](../wiki/Class.Packet)\>

#### Returns

`Promise`\<[`Packet`](../wiki/Class.Packet)\>

#### Source

lib/printer.ts:291

***

### startPrint()

> **startPrint**(): `Promise`\<[`Packet`](../wiki/Class.Packet)\>

#### Returns

`Promise`\<[`Packet`](../wiki/Class.Packet)\>

#### Source

lib/printer.ts:285
