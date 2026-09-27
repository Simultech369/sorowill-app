import type { Metadata } from 'next';

import { getSoroWillClient } from '@/lib/sorowill';
import InheritPageClient from './InheritPageClient';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  let title = 'Inheritance';
  let description = 'Claim your inheritance from a SoroWill.';
  const { id } = await params;

  try {
    const will = await getSoroWillClient().getWill(id);
    title = `Inheritance — Will #${will.id}`;
    description = `Claim your inheritance from Will #${will.id}. Status: ${will.status}. Locked balance: ${(Number(will.balance) / 1_000_000).toFixed(2)} USDC. ${will.beneficiaries.length} beneficiaries.`;
  } catch (err) {
    // Graceful fallback — log error for debugging and keep generic metadata.
    console.error('Failed to load will metadata:', err);
  }

  return { title, description };
}

export default async function InheritPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InheritPageClient id={id} />;
}
