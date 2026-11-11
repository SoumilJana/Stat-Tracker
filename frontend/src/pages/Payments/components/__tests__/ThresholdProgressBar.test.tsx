import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThresholdProgressBar } from '../ThresholdProgressBar';

describe('Phase 3: ThresholdProgressBar Component', () => {
  it('renders pre-threshold message when active players < 10', () => {
    render(<ThresholdProgressBar activeCount={6} />);

    expect(screen.getByText('6 / 10 Players')).toBeInTheDocument();
    expect(screen.getByText(/Need 4 more players to confirm turf/i)).toBeInTheDocument();
  });

  it('renders 5v5 confirmed message when active players reach 10', () => {
    render(<ThresholdProgressBar activeCount={10} />);

    expect(screen.getByText('10 Players Joined')).toBeInTheDocument();
    expect(screen.getByText('5v5 Confirmed')).toBeInTheDocument();
    expect(screen.getByText(/Standard 5v5 Confirmed/i)).toBeInTheDocument();
  });

  it('renders waitlist progression towards 15 players when active count is between 11 and 14', () => {
    render(<ThresholdProgressBar activeCount={13} />);

    expect(screen.getByText('13 Players Joined')).toBeInTheDocument();
    expect(screen.getByText(/3 on waitlist/i)).toBeInTheDocument();
    expect(screen.getByText(/2 more to auto-switch to 3 Teams Winner Stays/i)).toBeInTheDocument();
  });

  it('renders 3-Team Mode Confirmed when 15 players join', () => {
    render(<ThresholdProgressBar activeCount={15} />);

    expect(screen.getByText(/15 Players \(3 Teams Confirmed\)/i)).toBeInTheDocument();
    expect(screen.getByText('3-Team Mode')).toBeInTheDocument();
    expect(screen.getByText(/Match automatically upgraded to 3 Teams Winner Stays/i)).toBeInTheDocument();
  });
});
