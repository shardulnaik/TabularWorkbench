function stringify(value) {
    if (value === null || value === undefined)
        return '—';
    if (typeof value === 'object')
        return JSON.stringify(value);
    return String(value);
}
export function DataPreviewTable({ rows, maxColumns = 8 }) {
    if (!rows.length)
        return <div className="empty-state">No preview rows are available.</div>;
    const columns = Object.keys(rows[0]).slice(0, maxColumns);
    return <div className="table-scroll"><table className="data-table"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.slice(0, 10).map((row, index) => <tr key={index}>{columns.map((column) => <td key={column} title={stringify(row[column])}>{stringify(row[column])}</td>)}</tr>)}</tbody></table></div>;
}
