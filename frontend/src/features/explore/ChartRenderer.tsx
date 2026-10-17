import { useRef } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { toPng } from 'html-to-image';
import type { ChartData } from '../../types/charts';

export function ChartRenderer({ chart }: { chart: ChartData }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const data = chart.data || [];
  const saveImage = async () => {
    if (!chartRef.current) return;
    try {
      const url = await toPng(chartRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${chart.chart_type}-chart.png`;
      anchor.click();
    } catch {
      window.alert('The chart image could not be exported. You can still download its underlying data.');
    }
  };
  return <section className="panel chart-result"><div className="panel-heading"><div><h2>{chart.title}</h2><p>{chart.sample_count !== undefined ? `${chart.sample_count.toLocaleString()} row(s) represented` : 'Generated from the current cleaned dataset'}</p></div><button className="button button-secondary button-small" onClick={saveImage}>Download image</button></div>
    <div className="chart-canvas" ref={chartRef}>
      {chart.chart_type === 'correlation_heatmap' ? <div className="heatmap-wrap"><div className="heatmap-grid" style={{ gridTemplateColumns: `repeat(${chart.columns?.length || 1}, minmax(52px, 1fr))` }}>{chart.matrix?.map((row, y) => row.map((value, x) => <div className="heatmap-cell" key={`${x}-${y}`} title={`${chart.columns?.[y]} vs ${chart.columns?.[x]}: ${value}`} style={{ backgroundColor: heatColor(value) }}><span>{value.toFixed(2)}</span></div>))}</div><div className="heatmap-labels">{chart.columns?.map((column) => <span key={column}>{column}</span>)}</div></div> : <ResponsiveContainer width="100%" height="100%">
        {chart.chart_type === 'line' ? <LineChart data={data} margin={{ top: 12, right: 22, left: 4, bottom: 28 }}><CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" /><XAxis dataKey={chart.x_key || 'x'} tick={{ fontSize: 11 }} angle={-20} textAnchor="end" /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey={chart.y_key || 'y'} stroke="#5268e8" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} /></LineChart> : chart.chart_type === 'scatter' ? <ScatterChart margin={{ top: 12, right: 22, left: 4, bottom: 18 }}><CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" /><XAxis type="number" dataKey="x" name={chart.x_key || 'X'} tick={{ fontSize: 11 }} /><YAxis type="number" dataKey="y" name={chart.y_key || 'Y'} tick={{ fontSize: 11 }} /><Tooltip cursor={{ strokeDasharray: '3 3' }} /><Scatter data={data} fill="#5268e8" fillOpacity={0.72} /></ScatterChart> : <BarChart data={data} margin={{ top: 12, right: 22, left: 4, bottom: 44 }}><CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" /><XAxis dataKey={chart.x_key || (chart.chart_type === 'histogram' ? 'bin' : 'x')} tick={{ fontSize: 11 }} angle={-25} textAnchor="end" interval="preserveStartEnd" /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey={chart.y_key || (chart.chart_type === 'histogram' ? 'count' : 'y')} fill="#5268e8" radius={[5, 5, 0, 0]}>{data.map((entry, index) => <Cell key={index} fill={index % 2 === 0 ? '#5268e8' : '#7b8bf0'} />)}</Bar></BarChart>}
      </ResponsiveContainer>}
    </div>
    {chart.note && <p className="field-note">{chart.note}</p>}
  </section>;
}

function heatColor(value: number): string {
  const intensity = Math.min(1, Math.abs(value));
  if (value < 0) return `rgba(224, 92, 111, ${0.12 + intensity * 0.7})`;
  return `rgba(82, 104, 232, ${0.08 + intensity * 0.78})`;
}
