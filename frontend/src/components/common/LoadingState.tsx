import { LoaderCircle } from 'lucide-react';

export function LoadingState({ label = 'Loading your analysis…' }: { label?: string }) {
  return <div className="state-panel"><LoaderCircle className="spin" size={25} /><div><strong>{label}</strong><p>This usually takes a moment.</p></div></div>;
}
