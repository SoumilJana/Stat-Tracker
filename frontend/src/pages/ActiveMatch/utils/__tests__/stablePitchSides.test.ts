import { describe, it, expect } from 'vitest';
import { orderPitchSides } from '../stablePitchSides';

const A = { id: 'A' };
const B = { id: 'B' };
const C = { id: 'C' };

describe('orderPitchSides', () => {
  it('uses the engine order the first time', () => {
    expect(orderPitchSides(null, [A, B])).toEqual([A, B]);
  });

  it('keeps the left team on the left when it wins', () => {
    expect(orderPitchSides(['A', 'B'], [A, C])).toEqual([A, C]);
  });

  it('keeps the right team on the right when it wins', () => {
    // Engine lists the winner (B) first; B should stay on the right
    expect(orderPitchSides(['A', 'B'], [B, C])).toEqual([C, B]);
  });

  it('does not swap sides when the same two teams are listed the other way round', () => {
    expect(orderPitchSides(['A', 'B'], [B, A])).toEqual([A, B]);
  });
});
