import { describe, expect, it } from 'vitest';

import { getMoodEmoji } from './mood';

describe('getMoodEmoji', () => {
  it.each([
    [-50, '😭'],
    [-41, '😭'],
    [-40, '😢'],
    [-31, '😢'],
    [-30, '😣'],
    [-21, '😣'],
    [-20, '😞'],
    [-11, '😞'],
    [-10, '🙁'],
    [-1, '🙁'],
    [0, '😐'],
    [10, '😐'],
    [11, '🙂'],
    [20, '🙂'],
    [21, '😊'],
    [30, '😊'],
    [31, '😄'],
    [40, '😄'],
    [41, '🤩'],
    [50, '🤩'],
  ])('maps score %i to %s', (score, emoji) => {
    expect(getMoodEmoji(score)).toBe(emoji);
  });
});
