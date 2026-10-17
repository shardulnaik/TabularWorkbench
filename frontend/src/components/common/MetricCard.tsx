import type { LucideIcon } from 'lucide-react';

export function MetricCard({ label, value, hint, icon: Icon }: { label: string; value: string | number; hint?: string; icon?: LucideIcon }) {
  return <div className="metric-card"><div className="metric-card-top"><span>{label}</span>{Icon && <span className="metric-icon"><Icon size={17} /></span>}</div><strong>{value}</strong>{hint && <small>{hint}</small>}</div>;
}
