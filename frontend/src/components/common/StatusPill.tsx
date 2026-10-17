import type { ReactNode } from 'react';

export function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warning' | 'info' }) {
  return <span className={`status-pill tone-${tone}`}>{children}</span>;
}
