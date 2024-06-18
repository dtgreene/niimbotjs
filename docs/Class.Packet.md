[github-wiki-example](../wiki/Home) / Packet

# Class: Packet

## Constructors

### new Packet()

> **new Packet**(`type`, `data`): [`Packet`](../wiki/Class.Packet)

#### Parameters

| Parameter | Type |
| :------ | :------ |
| `type` | `number` |
| `data` | `Buffer` |

#### Returns

[`Packet`](../wiki/Class.Packet)

#### Source

lib/packet.ts:6

## Properties

| Property | Type |
| :------ | :------ |
| `data` | `Buffer` |
| `type` | `number` |

## Methods

### toBytes()

> **toBytes**(): `Buffer`

#### Returns

`Buffer`

#### Source

lib/packet.ts:27

***

### fromBytes()

> `static` **fromBytes**(`bytes`): [`Packet`](../wiki/Class.Packet)

#### Parameters

| Parameter | Type |
| :------ | :------ |
| `bytes` | `Buffer` |

#### Returns

[`Packet`](../wiki/Class.Packet)

#### Source

lib/packet.ts:10
