import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtext?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  color,
  trend,
  subtext,
}: StatCardProps) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm text-muted font-medium">{label}</p>
          <div className="mt-1">
            <p className="text-2xl font-bold">{value}</p>
            {subtext && <p className="text-xs text-muted mt-1">{subtext}</p>}
          </div>
        </div>
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{
            backgroundColor: `${color}20`,
          }}
        >
          <Icon size={20} style={{ color }} />
        </div>
      </div>

      {trend && (
        <div className="flex items-center gap-1 text-xs">
          <span
            className={cn(
              'font-medium',
              trend.isPositive ? 'text-on-state' : 'text-red-warn'
            )}
          >
            {trend.isPositive ? '+' : '-'}{Math.abs(trend.value)}%
          </span>
          <span className="text-muted">vs last period</span>
        </div>
      )}
    </div>
  );
}
