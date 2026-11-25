import { describe, it, expect } from 'vitest';
import { feeDifference } from '../gamePaymentsApi';
import type { GamePayment } from '../../types/gamePayment';

const pay = (status: GamePayment['status'], amount: number): GamePayment => ({
  id: 'p', game_id: 'g', user_id: 'u', amount, method: 'UPI', status
});

describe('feeDifference', () => {
  it('is positive (refund) when a paid player paid more than the fee', () => {
    expect(feeDifference(pay('VERIFIED', 80), 70)).toBe(10);
    expect(feeDifference(pay('AWAITING_VERIFICATION', 80), 60)).toBe(20);
  });

  it('is negative (top-up) when the fee went up', () => {
    expect(feeDifference(pay('VERIFIED', 80), 100)).toBe(-20);
  });

  it('is zero for unpaid, refunded or missing payments', () => {
    expect(feeDifference(pay('PENDING', 80), 100)).toBe(0);
    expect(feeDifference(pay('REFUND_PENDING', 80), 100)).toBe(0);
    expect(feeDifference(null, 100)).toBe(0);
    expect(feeDifference(pay('VERIFIED', 80), 80)).toBe(0);
  });
});
