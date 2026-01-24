import { createHash } from 'node:crypto';

export function sha256Hex(input: string | Buffer): `0x${string}` {
  return `0x${createHash('sha256').update(input).digest('hex')}`;
}
