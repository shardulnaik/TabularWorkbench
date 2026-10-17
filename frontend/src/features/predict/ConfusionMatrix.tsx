export function ConfusionMatrix({ labels, matrix }: { labels: string[]; matrix: number[][] }) {
  return <div className="table-scroll"><table className="data-table confusion-table"><thead><tr><th>Actual ↓ / Predicted →</th>{labels.map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{matrix.map((row, index) => <tr key={labels[index]}><th>{labels[index]}</th>{row.map((value, cellIndex) => <td className={index === cellIndex ? 'diagonal-cell' : ''} key={cellIndex}>{value.toLocaleString()}</td>)}</tr>)}</tbody></table></div>;
}
