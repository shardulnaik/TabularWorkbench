import { CheckCircle2, Info, ShieldCheck } from 'lucide-react';
export function CleaningPlan({ plan, selected, onToggle }) {
    return <div className="cleaning-list">{plan.actions.map((action) => <label key={action.id} className={`cleaning-item ${!action.available ? 'unavailable' : ''}`}>
    <input type="checkbox" checked={selected.includes(action.id)} disabled={!action.available} onChange={() => onToggle(action.id)}/>
    <span className="cleaning-check">{selected.includes(action.id) ? <CheckCircle2 size={19}/> : <ShieldCheck size={19}/>}</span>
    <span className="cleaning-copy"><strong>{action.title}</strong><small>{action.description}</small><span className="cleaning-meta">{action.available ? `${action.estimated_cells_or_rows.toLocaleString()} cell(s) or row(s) estimated` : 'No changes needed'}{action.recommended && action.available ? ' · Recommended' : ''}</span></span>
    {action.id === 'remove_duplicates' && <span className="info-icon" title="Repeated rows can sometimes be legitimate records."><Info size={17}/></span>}
  </label>)}</div>;
}
