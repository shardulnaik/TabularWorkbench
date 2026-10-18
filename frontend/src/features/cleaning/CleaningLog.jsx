export function CleaningLog({ items }) {
    if (!items.length)
        return <p className="muted-copy">No cleaning changes have been applied yet.</p>;
    return <div className="log-list">{items.map((item, index) => <div className="log-item" key={`${item.action_id}-${index}`}><span className="log-check">✓</span><div><strong>{item.title || item.action_id}</strong><p>{(item.rows_affected ?? 0).toLocaleString()} cell(s) or row(s) affected</p></div></div>)}</div>;
}
