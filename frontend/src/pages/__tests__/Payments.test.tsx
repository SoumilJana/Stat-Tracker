import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Payments from '../Payments';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    useReducedMotion: () => false,
  };
});

describe('Payments Page', () => {
  it('renders the header and description', () => {
    render(<Payments />);
    expect(screen.getByRole('heading', { level: 1, name: /Payments/i })).toBeInTheDocument();
    expect(screen.getByText(/Track match dues, pitch bookings, and team payment balances/i)).toBeInTheDocument();
  });

  it('renders the subtle Coming Soon card and details', () => {
    render(<Payments />);
    expect(screen.getByText(/Coming Soon/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Payments Module In Development/i })).toBeInTheDocument();
    expect(screen.getByText(/automated match fee tracking/i)).toBeInTheDocument();
  });
});
