'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { COLORS } from '@/lib/colors';

interface EnergyChartProps {
  data: Array<{ label: string; value: number }>;
  type?: 'bar' | 'line';
  height?: number;
}

export function EnergyChart({ data, type = 'bar', height = 300 }: EnergyChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted">
        No data available
      </div>
    );
  }

  const chartData = data.map((item) => ({
    name: item.label,
    value: item.value,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      {type === 'line' ? (
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
          <XAxis dataKey="name" stroke={COLORS.textMuted} />
          <YAxis stroke={COLORS.textMuted} />
          <Tooltip
            contentStyle={{
              backgroundColor: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: '8px',
            }}
            labelStyle={{ color: COLORS.textPrimary }}
            formatter={(value) => `${Number(value).toFixed(2)} kWh`}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={COLORS.accentTeal}
            strokeWidth={2}
            dot={{ fill: COLORS.accentTeal, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      ) : (
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
          <XAxis dataKey="name" stroke={COLORS.textMuted} />
          <YAxis stroke={COLORS.textMuted} />
          <Tooltip
            contentStyle={{
              backgroundColor: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: '8px',
            }}
            labelStyle={{ color: COLORS.textPrimary }}
            formatter={(value) => `${Number(value).toFixed(2)} kWh`}
          />
          <Bar dataKey="value" fill={COLORS.accentTeal} radius={[8, 8, 0, 0]} />
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}
