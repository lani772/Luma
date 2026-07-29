import { formatDistanceToNow } from 'date-fns';
import {
  Lightbulb,
  Zap,
  User,
  Lock,
  Settings,
  AlertCircle,
  LucideIcon,
} from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'device' | 'scene' | 'user' | 'security' | 'system' | 'alert';
  title: string;
  description: string;
  timestamp: Date;
  severity?: 'low' | 'medium' | 'high';
}

const typeIcons: Record<string, LucideIcon> = {
  device: Lightbulb,
  scene: Zap,
  user: User,
  security: Lock,
  system: Settings,
  alert: AlertCircle,
};

const typeColors: Record<string, string> = {
  device: 'text-blue-400 bg-blue-500/10',
  scene: 'text-yellow-400 bg-yellow-500/10',
  user: 'text-purple-400 bg-purple-500/10',
  security: 'text-red-400 bg-red-500/10',
  system: 'text-slate-400 bg-slate-500/10',
  alert: 'text-orange-400 bg-orange-500/10',
};

const severityColors: Record<string, string> = {
  low: 'border-green-500/20 bg-green-500/5',
  medium: 'border-yellow-500/20 bg-yellow-500/5',
  high: 'border-red-500/20 bg-red-500/5',
};

interface ActivityLogProps {
  items: ActivityItem[];
  maxItems?: number;
}

export function ActivityLog({ items, maxItems = 10 }: ActivityLogProps) {
  const displayItems = items.slice(0, maxItems);

  return (
    <div className="space-y-2">
      {displayItems.map((item) => {
        const Icon = typeIcons[item.type];
        const borderClass = item.severity ? severityColors[item.severity] : '';

        return (
          <div
            key={item.id}
            className={`rounded-lg border border-slate-700/50 p-3 transition-colors hover:border-slate-600/50 ${borderClass}`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${typeColors[item.type]}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-100 text-sm">{item.title}</p>
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{item.description}</p>
              </div>
              <span className="text-xs text-slate-500 whitespace-nowrap">
                {formatDistanceToNow(item.timestamp, { addSuffix: true })}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
