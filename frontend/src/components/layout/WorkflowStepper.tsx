import { Check } from 'lucide-react';

const labels = ['Upload', 'Health', 'Clean', 'Explore', 'Predict', 'Results'];

export function WorkflowStepper({ current }: { current: number }) {
  return <div className="compact-stepper" aria-label="Workflow progress">{labels.map((label, index) => <div className={`compact-step ${index === current ? 'active' : index < current ? 'complete' : ''}`} key={label}><span>{index < current ? <Check size={12} /> : String(index + 1).padStart(2, '0')}</span>{label}</div>)}</div>;
}
