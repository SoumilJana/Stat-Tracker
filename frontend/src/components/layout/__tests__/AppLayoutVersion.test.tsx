import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppLayout from '../AppLayout';
import { APP_VERSION } from '../../../version';

// Mock dependencies
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    profile: null,
    signOut: vi.fn(),
  }),
}));

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    useReducedMotion: () => false,
  };
});

describe('AppLayout Version Tag Visibility', () => {
  it('renders the version tag in both desktop sidebar and mobile header', () => {
    const { container } = render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );

    const versionElements = screen.getAllByText(`v${APP_VERSION}`);
    // Should be exactly 2: one for desktop sidebar, one for mobile top header
    expect(versionElements.length).toBe(2);

    // Desktop sidebar version badge
    const desktopHeader = container.querySelector('nav.hidden.md\\:flex');
    expect(desktopHeader).not.toBeNull();
    expect(desktopHeader?.textContent).toContain(`v${APP_VERSION}`);

    // Mobile top header brand lockup
    const mobileHeaderBrand = container.querySelector('header .flex.md\\:hidden');
    expect(mobileHeaderBrand).not.toBeNull();
    expect(mobileHeaderBrand?.textContent).toContain('StatTracker');
    expect(mobileHeaderBrand?.textContent).toContain(`v${APP_VERSION}`);
  });
});
