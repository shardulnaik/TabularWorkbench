const labels = {
    histogram: 'Histogram', bar: 'Bar chart', line: 'Line chart', scatter: 'Scatter plot', correlation_heatmap: 'Correlation heatmap',
};
export function ChartBuilder({ columns, chartType, setChartType, xColumn, setXColumn, yColumn, setYColumn, aggregation, setAggregation, onGenerate, busy }) {
    const numeric = columns.filter((column) => column.kind === 'numeric' && !column.is_constant);
    const xOptions = chartType === 'histogram' ? numeric : chartType === 'line' ? columns.filter((column) => ['numeric', 'datetime'].includes(column.kind)) : chartType === 'scatter' ? numeric : columns;
    const needsY = chartType === 'scatter' || chartType === 'line' || (chartType === 'bar' && Boolean(yColumn));
    return <section className="panel chart-builder"><div className="panel-heading"><div><h2>Build a chart</h2><p>Choose the question first. We'll only offer compatible columns.</p></div></div>
    <div className="form-grid"><label className="field"><span>Chart type</span><select value={chartType} onChange={(event) => setChartType(event.target.value)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {chartType !== 'correlation_heatmap' && <label className="field"><span>{chartType === 'histogram' ? 'Numeric column' : 'X-axis'}</span><select value={xColumn} onChange={(event) => setXColumn(event.target.value)}>{xOptions.map((column) => <option key={column.name} value={column.name}>{column.name}</option>)}</select></label>}
      {['scatter', 'line', 'bar'].includes(chartType) && <label className="field"><span>Y-axis {chartType === 'bar' ? '(optional)' : ''}</span><select value={yColumn} onChange={(event) => setYColumn(event.target.value)}><option value="">{chartType === 'bar' ? 'Count categories' : 'Choose a column'}</option>{numeric.map((column) => <option key={column.name} value={column.name}>{column.name}</option>)}</select></label>}
      {chartType === 'bar' && yColumn && <label className="field"><span>Combine repeated X values using</span><select value={aggregation} onChange={(event) => setAggregation(event.target.value)}><option value="mean">Average</option><option value="sum">Sum</option><option value="median">Median</option><option value="count">Count</option></select></label>}
    </div>
    {chartType === 'correlation_heatmap' && <p className="field-note">Uses the numeric columns in your current cleaned dataset.</p>}
    {chartType === 'bar' && !yColumn && <p className="field-note">Without a Y-axis, the chart counts the most frequent values in the selected X column.</p>}
    {needsY && !yColumn && <p className="inline-error">Choose a numeric Y-axis column to generate this chart.</p>}
    <button className="button button-primary" onClick={onGenerate} disabled={busy || (chartType !== 'correlation_heatmap' && !xColumn) || (needsY && !yColumn)}>{busy ? 'Generating…' : 'Generate chart'}</button>
  </section>;
}
