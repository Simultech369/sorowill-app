import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';

import WillDetailPage from '@/app/will/[id]/page';
import InheritPageClient from '@/app/inherit/[id]/InheritPageClient';
import DashboardPage from '@/app/dashboard/page';
import WillDetailError from '@/app/will/[id]/error';
import InheritDetailError from '@/app/inherit/[id]/error';
import DashboardError from '@/app/dashboard/error';
import { ToastProvider } from '@/components/Toast';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '42' }),
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock freighter
vi.mock('@/lib/freighter', () => ({
  safeGetPublicKey: vi.fn().mockResolvedValue('GTESTPUBLICKEY1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
  truncateAddress: (val: string) => val.slice(0, 8),
}));

// Mock CountdownTimer to avoid setInterval keeping Node event loop alive
vi.mock('@/components/CountdownTimer', () => ({
  CountdownTimer: () => <div data-testid="countdown-timer">Countdown</div>,
}));

// Mock sorowill SDK client
const mockGetWill = vi.fn();
const mockGetWillsByOwner = vi.fn();
const mockGetWillsByBeneficiary = vi.fn();

vi.mock('@/lib/sorowill', () => ({
  getSoroWillClient: () => ({
    getWill: mockGetWill,
    getWillsByOwner: mockGetWillsByOwner,
    getWillsByBeneficiary: mockGetWillsByBeneficiary,
    checkIn: vi.fn(),
  }),
  getWillsByGuardian: vi.fn().mockResolvedValue({ wills: [], hasErrors: false }),
  stellarExpertUrl: (addr: string) => `https://stellar.expert/${addr}`,
}));

describe('Issue #440: RPC/SDK data-load failure and error boundaries', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockGetWill.mockReset();
    mockGetWillsByOwner.mockReset();
    mockGetWillsByBeneficiary.mockReset();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('catches getWill RPC failure in WillDetailPage, logs stack, and renders friendly error with retry', async () => {
    const rpcError = new Error('RPC connection timeout at https://soroban-testnet.stellar.org');
    mockGetWill.mockRejectedValue(rpcError);

    render(
      <ToastProvider>
        <WillDetailPage />
      </ToastProvider>,
    );

    // Wait for the retry button to appear in the error state
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    // Acceptance criteria checks:
    // 1. User sees "Could not load will — check your connection"
    expect(screen.getAllByText('Could not load will — check your connection').length).toBeGreaterThan(0);

    // 2. Retry option is available
    const retryButton = screen.getByRole('button', { name: /try again/i });
    expect(retryButton).toBeInTheDocument();

    // 3. Error logs include full stack for debugging
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load will:', rpcError);

    // 4. No raw error objects or stack traces reach the UI
    expect(screen.queryByText(/\[object Object\]/)).not.toBeInTheDocument();
    expect(screen.queryByText(/at SoroWillClient/)).not.toBeInTheDocument();

    // 5. Clicking retry attempts to refetch
    fireEvent.click(retryButton);
    await waitFor(() => {
      expect(mockGetWill).toHaveBeenCalledTimes(2);
    });
  });

  it('catches getWill RPC failure in InheritPageClient, logs stack, and renders friendly error with retry', async () => {
    const rpcError = new Error('Failed to fetch from RPC node');
    mockGetWill.mockRejectedValue(rpcError);

    render(
      <ToastProvider>
        <InheritPageClient id="42" />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    expect(screen.getAllByText('Could not load will — check your connection').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load will for inheritance:', rpcError);
    expect(screen.queryByText(/\[object Object\]/)).not.toBeInTheDocument();
  });

  it('catches initial data-load failure in DashboardPage, logs stack, and renders friendly error with retry', async () => {
    const networkError = new Error('Network request failed: connection refused');
    mockGetWillsByOwner.mockRejectedValue(networkError);
    mockGetWillsByBeneficiary.mockResolvedValue([]);

    render(
      <ToastProvider>
        <DashboardPage />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    expect(screen.getAllByText('Could not load will — check your connection').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load dashboard wills:', networkError);
    expect(screen.queryByText(/\[object Object\]/)).not.toBeInTheDocument();
  });

  it('WillDetailError renders friendly message and logs full stack to console.error', () => {
    const testError = new Error('Test boundary error in WillDetail');
    const resetFn = vi.fn();

    render(<WillDetailError error={testError} reset={resetFn} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Could not load will — check your connection')).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Will detail route error boundary caught error:',
      testError,
    );

    const tryAgainBtn = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(tryAgainBtn);
    expect(resetFn).toHaveBeenCalledTimes(1);
  });

  it('InheritDetailError renders friendly message and logs full stack to console.error', () => {
    const testError = new Error('Test boundary error in InheritDetail');
    const resetFn = vi.fn();

    render(<InheritDetailError error={testError} reset={resetFn} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Could not load will — check your connection')).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Inherit detail route error boundary caught error:',
      testError,
    );

    const tryAgainBtn = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(tryAgainBtn);
    expect(resetFn).toHaveBeenCalledTimes(1);
  });

  it('DashboardError renders friendly message and logs full stack to console.error', () => {
    const testError = new Error('Test boundary error in Dashboard');
    const resetFn = vi.fn();

    render(<DashboardError error={testError} reset={resetFn} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Could not load will — check your connection')).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Dashboard route error boundary caught error:',
      testError,
    );

    const tryAgainBtn = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(tryAgainBtn);
    expect(resetFn).toHaveBeenCalledTimes(1);
  });
});
