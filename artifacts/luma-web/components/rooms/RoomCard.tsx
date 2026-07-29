import { LucideIcon, ChevronRight, Zap } from 'lucide-react';

interface RoomCardProps {
  id: string;
  name: string;
  icon: LucideIcon;
  deviceCount: number;
  activeDevices: number;
  temperature?: number;
  humidity?: number;
  powerUsage?: number;
  onClick?: () => void;
}

export function RoomCard({
  name,
  icon: Icon,
  deviceCount,
  activeDevices,
  temperature,
  humidity,
  powerUsage,
  onClick,
}: RoomCardProps) {
  const activePercentage = deviceCount > 0 ? (activeDevices / deviceCount) * 100 : 0;

  return (
    <div
      onClick={onClick}
      className="group relative rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-4 backdrop-blur-sm transition-all duration-300 hover:border-blue-500/30 hover:bg-gradient-to-br hover:from-slate-800/70 hover:to-slate-900/50 hover:shadow-lg hover:shadow-blue-500/10 cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
            <Icon className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100">{name}</h3>
            <p className="text-xs text-slate-400">{deviceCount} devices</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
      </div>

      <div className="space-y-2">
        {/* Active Devices Progress */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-slate-700/50 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${activePercentage}%` }}
            />
          </div>
          <span className="text-xs font-medium text-slate-300">
            {activeDevices}/{deviceCount}
          </span>
        </div>

        {/* Environmental Stats */}
        <div className="flex gap-3 text-xs">
          {temperature !== undefined && (
            <div className="flex items-center gap-1 text-slate-400">
              <span>🌡</span>
              <span>{temperature}°C</span>
            </div>
          )}
          {humidity !== undefined && (
            <div className="flex items-center gap-1 text-slate-400">
              <span>💧</span>
              <span>{humidity}%</span>
            </div>
          )}
        </div>

        {/* Power Usage */}
        {powerUsage !== undefined && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-700/30">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs text-slate-400">{powerUsage}W</span>
          </div>
        )}
      </div>
    </div>
  );
}
