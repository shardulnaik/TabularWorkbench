import { AlertTriangle, CheckCircle2, Rows3, Columns3, CircleHelp, Database } from 'lucide-react';
import { MetricCard } from '../../components/common/MetricCard';
import { StatusPill } from '../../components/common/StatusPill';
export function ProfileSummary({ profile }) {
    const statusTone = profile.health_status === 'Good' ? 'good' : profile.health_status === 'Needs attention' ? 'warning' : 'info';
    return <>
    <div className="metrics-grid">
      <MetricCard label="Rows" value={profile.row_count.toLocaleString()} icon={Rows3}/>
      <MetricCard label="Columns" value={profile.column_count.toLocaleString()} icon={Columns3}/>
      <MetricCard label="Missing cells" value={profile.missing_cells.toLocaleString()} hint={`${profile.missing_percentage}% of all cells`} icon={CircleHelp}/>
      <MetricCard label="Exact duplicate rows" value={profile.duplicate_rows.toLocaleString()} icon={Database}/>
    </div>
    <div className="health-banner"><div className="health-banner-icon">{profile.health_status === 'Good' ? <CheckCircle2 size={21}/> : <AlertTriangle size={21}/>}</div><div className="health-banner-copy"><strong>Dataset health: {profile.health_status}</strong><span>{profile.warnings.length ? `${profile.warnings.length} item(s) to review before analysis.` : 'No major data-quality warnings were detected.'}</span></div><StatusPill tone={statusTone}>{profile.health_status}</StatusPill></div>
  </>;
}
