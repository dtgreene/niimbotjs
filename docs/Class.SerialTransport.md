[github-wiki-example](../wiki/Home) / SerialTransport

# Class: SerialTransport

## Constructors

### new SerialTransport()

> **new SerialTransport**(): [`SerialTransport`](../wiki/Class.SerialTransport)

#### Returns

[`SerialTransport`](../wiki/Class.SerialTransport)

## Properties

| Property | Modifier | Type | Default value |
| :------ | :------ | :------ | :------ |
| `port` | `private` | `SerialPort`\<`AutoDetectTypes`\> | `null` |

## Methods

### close()

> **close**(): `void`

#### Returns

`void`

#### Source

lib/serial.ts:48

***

### handlePortClose()

> `private` **handlePortClose**(): `void`

#### Returns

`void`

#### Source

lib/serial.ts:21

***

### isOpen()

> **isOpen**(): `boolean`

#### Returns

`boolean`

#### Source

lib/serial.ts:54

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

lib/serial.ts:24

***

### read()

> **read**(`size`?): `any`

#### Parameters

| Parameter | Type |
| :------ | :------ |
| `size`? | `number` |

#### Returns

`any`

#### Source

lib/serial.ts:57

***

### write()

> **write**(`data`): `any`

#### Parameters

| Parameter | Type |
| :------ | :------ |
| `data` | `Buffer` |

#### Returns

`any`

#### Source

lib/serial.ts:61
