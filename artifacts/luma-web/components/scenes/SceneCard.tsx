import { LucideIcon, Play, Edit2 } from 'lucide-react';
import { useState } from 'react';

interface SceneCardProps {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  isActive?: boolean;
  lastActivated?: string;
  deviceCount: number;
  onActivate?: () => void;
  onEdit?: () => void;
}

export function SceneCard({
  name,
  description,
  icon: Icon,
  color,
  isActive = false,
  lastActivated,
  deviceCount,
  onActivate,
  onEdit,
}: SceneCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleActivate = async () => {
    setIsLoading(true);
    try {
      await onActivate?.();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`relative rounded-lg border transition-all duration-300 p-5 backdrop-blur-sm ${
        isActive
          ? 'border-green-500/50 bg-gradient-to-br from-green-500/10 to-emerald-500/5 shadow-lg shadow-green-500/10'
          : 'border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 hover:border-slate-600 hover:shadow-md hover:shadow-slate-800/20'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="flex gap-1">
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
              title="Edit scene"
            >
              <Edit2 className="w-4 h-4 text-slate-400 hover:text-slate-200" />
            </button>
          )}
          <button
            onClick={handleActivate}
            disabled={isLoading}
            className={`p-1.5 rounded-lg transition-all ${
              isActive
                ? 'bg-green-500/20 text-green-400'
                : 'hover:bg-blue-500/20 text-slate-400 hover:text-blue-400'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isActive ? 'Scene active' : 'Activate scene'}
          >
            <Play
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
              fill="currentColor"
            />
          </button>
        </div>
      </div>

      <div className="mb-3">
        <h3 className="font-semibold text-slate-100">{name}</h3>
        <p className="text-sm text-slate-400 line-clamp-2">{description}</p>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-700/30">
        <span className="text-xs text-slate-500">{deviceCount} devices</span>
        {lastActivated && (
          <span className="text-xs text-slate-500">Last: {lastActivated}</span>
        )}
        {isActive && (
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        )}
      </div>
    </div>
  );
}
