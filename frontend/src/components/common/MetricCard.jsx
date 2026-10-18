export function MetricCard({ label, value, hint, icon: Icon }) {
    return <div className="metric-card"><div className="metric-card-top"><span>{label}</span>{Icon && <span className="metric-icon"><Icon size={17}/></span>}</div><strong>{value}</strong>{hint && <small>{hint}</small>}</div>;
}
