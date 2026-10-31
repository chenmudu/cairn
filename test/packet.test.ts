import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as packet from '../src/packet.ts';

test('packet exports no unused markdown renderer', () => {
  assert.equal('renderDispatch' in packet, false);
});