type Slice = {
  label: string;
  value: number;
  color: string;
};

type PieChartProps = {
  data: Slice[];
};

export function PieChart({ data }: PieChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const slices = data.reduce<Array<Slice & { dash: string; offset: number }>>((items, item) => {
    const percent = total ? (item.value / total) * 100 : 0;
    const previousOffset = items.at(-1)?.offset ?? 25;
    const previousPercent = items.length
      ? Number.parseFloat(items.at(-1)?.dash.split(" ")[0] ?? "0")
      : 0;

    items.push({
      ...item,
      dash: `${percent} ${100 - percent}`,
      offset: items.length ? previousOffset - previousPercent : 25,
    });

    return items;
  }, []);

  return (
    <div className="pie-wrap">
      <svg className="pie" viewBox="0 0 42 42" role="img" aria-label="本月支出分類">
        <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="rgba(255,255,255,.08)" strokeWidth="7" />
        {slices.map((item) => (
          <circle
            key={item.label}
            cx="21"
            cy="21"
            r="15.915"
            fill="transparent"
            stroke={item.color}
            strokeDasharray={item.dash}
            strokeDashoffset={item.offset}
            strokeWidth="7"
          />
        ))}
      </svg>
      <div className="pie-legend">
        {data.map((item) => (
          <div className="legend-row" key={item.label}>
            <span className="legend-dot" style={{ backgroundColor: item.color }} />
            <span>{item.label}</span>
            <strong>{Math.round((item.value / total) * 100)}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
