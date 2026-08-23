'use client';

import { Lamp } from '@/lib/types';
import { COLORS } from '@/lib/colors';
import { formatPower, getDeviceStatus } from '@/lib/utils';
import { Wifi, WifiOff, Lightbulb, LightbulbOff } from 'lucide-react';
import Link from 'next/link';

interface DeviceCardProps {
  device: Lamp;
  onToggle?: (id: string, state: boolean) => void;
}

export function DeviceCard({ device, onToggle }: DeviceCardProps) {
  const statusColor = device.on ? COLORS.onState : COLORS.muted;
  const status = getDeviceStatus(device.online, device.on);

  return (
    <Link href={`/devices/${device.id}`}>
      <div className="glass rounded-xl p-4 hover:border-primary-blue/50 transition-all cursor-pointer group">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-sm truncate">{device.name}</h3>
            <p className="text-xs text-muted mt-1">{device.room}</p>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              onToggle?.(device.id, !device.on);
            }}
            aria-label={device.on ? `Turn off ${device.name}` : `Turn on ${device.name}`}
            title={device.on ? `Turn off ${device.name}` : `Turn on ${device.name}`}
            className="p-2 rounded-lg hover:bg-card-hover transition-colors ml-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {device.on ? (
              <Lightbulb size={18} style={{ color: COLORS.onState }} />
            ) : (
              <LightbulbOff size={18} style={{ color: COLORS.muted }} />
            )}
          </button>
        </div>

        <div className="space-y-2 mb-3">
          {/* Status Badges */}
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: device.online ? COLORS.onState : COLORS.muted,
              }}
            />
            <span className="text-xs font-medium" style={{ color: statusColor }}>
              {status}
            </span>
            {!device.online && <WifiOff size={14} className="text-muted" />}
          </div>

          {/* Power Display */}
          {device.on && (
            <div className="text-xs text-muted">
              {formatPower(device.power)} • {device.brightness}%
            </div>
          )}
        </div>

        {/* Health Indicator */}
        <div className="pt-3 border-t border-border">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Signal</span>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-1 h-3 rounded-sm"
                  style={{
                    backgroundColor:
                      i < Math.round(device.health.signalQuality / 20)
                        ? COLORS.accentTeal
                        : COLORS.border,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
