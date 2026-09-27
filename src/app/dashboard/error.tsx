'use client';

// NOTE: This boundary does NOT catch the primary data-fetch failure for this
// route. `dashboard/page.tsx` is a client component that loads its data
// inside useEffect/useCallback handlers wrapped in try/catch. Fetch failures
// are stored in local state and render an inline retry affordance, so they
// never throw into this boundary. This boundary only catches unexpected
// render-time errors elsewhere in the component tree.

import { useEffect } from 'react';
import { formatError } from '@/lib/errors';

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Dashboard route error boundary caught error:', error);
  }, [error]);

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-8 text-center" role="alert">
      <h1 className="text-lg font-semibold text-red-300">Could not load will — check your connection</h1>
      <p className="mt-2 text-sm text-red-300/70">{formatError(error)}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-full border border-red-400/40 px-4 py-2 text-sm text-red-300 transition hover:border-red-400/70"
      >
        Try again
      </button>
    </div>
  );
}
