import type { DatasetProfile } from '../../types/dataset';

export function StatsTable({ profile }: { profile: DatasetProfile }) {
  const numericRows = Object.entries(profile.numeric_summary);
  return <div className="panel"><div className="panel-heading"><div><h2>Summary statistics</h2><p>Numerical columns from your current dataset</p></div></div>
    {numericRows.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Column</th><th>Count</th><th>Mean</th><th>Median</th><th>Std. dev.</th><th>Minimum</th><th>Maximum</th></tr></thead><tbody>{numericRows.map(([name, stats]) => <tr key={name}><td className="cell-strong">{name}</td>{['count', 'mean', 'median', 'std', 'min', 'max'].map((key) => <td key={key}>{format(stats[key])}</td>)}</tr>)}</tbody></table></div> : <div className="empty-state">No numeric columns were detected.</div>}
    {Object.keys(profile.category_summary).length > 0 && <div className="category-summary"><h3>Most common values</h3><div className="category-grid">{Object.entries(profile.category_summary).slice(0, 6).map(([column, values]) => <div className="category-card" key={column}><strong>{column}</strong>{values.slice(0, 4).map((item) => <div className="category-line" key={item.value}><span>{item.value}</span><span>{item.count.toLocaleString()}</span></div>)}</div>)}</div></div>}
  </div>;
}

function format(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}
