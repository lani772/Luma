'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Lightbulb, Zap, Wifi, Clock, Info } from 'lucide-react';
import Link from 'next/link';
import { COLORS } from '@/lib/colors';
import { formatPower, timeAgo } from '@/lib/utils';

// Mock device data
const mockDevice = {
  id: '1',
  name: 'Living Room Lamp',
  room: 'Living Room',
  floor: '1',
  deviceId: 'mqtt-001',
  mac: '00:1A:2B:3C:4D:5E',
  online: true,
  on: true,
  brightness: 85,
  power: 45,
  lastSeen: Date.now(),
  firmware: '2.1.0',
  health: {
    rssi: -45,
    signalQuality: 90,
    ip: '192.168.1.100',
    uptime: '24d 5h',
    cpu: 35,
    memory: 60,
  },
};

export default function DeviceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const deviceId = params.id as string;

  const [brightness, setBrightness] = useState(mockDevice.brightness);
  const [isOn, setIsOn] = useState(mockDevice.on);

  const handleBrightnessChange = (value: number) => {
    setBrightness(value);
  };

  const handleToggle = () => {
    setIsOn(!isOn);
  };

  return (
    <div className="flex-1 p-6 md:p-8">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-primary-blue hover:text-primary-blue-light mb-6 transition-colors"
      >
        <ArrowLeft size={18} />
        Back to Devices
      </button>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">{mockDevice.name}</h1>
            <p className="text-muted mt-1">{mockDevice.room} • Floor {mockDevice.floor}</p>
          </div>
          <button
            onClick={handleToggle}
            className={`p-3 rounded-lg transition-colors ${
              isOn ? 'bg-on-state/20 text-on-state' : 'bg-muted/20 text-muted'
            }`}
          >
            <Lightbulb size={32} />
          </button>
        </div>

        {/* Status Bars */}
        <div className="flex gap-2 flex-wrap">
          <div
            className="px-3 py-1 rounded-full text-sm font-medium"
            style={{
              backgroundColor: mockDevice.online ? `${COLORS.onState}20` : `${COLORS.textMuted}20`,
              color: mockDevice.online ? COLORS.onState : COLORS.textMuted,
            }}
          >
            {mockDevice.online ? 'Online' : 'Offline'}
          </div>
          {isOn && (
            <div
              className="px-3 py-1 rounded-full text-sm font-medium"
              style={{
                backgroundColor: `${COLORS.onState}20`,
                color: COLORS.onState,
              }}
            >
              On
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Brightness Control */}
          <div className="glass rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Brightness</h2>
            <div className="space-y-4">
              <input
                type="range"
                min="0"
                max="100"
                value={brightness}
                onChange={(e) => handleBrightnessChange(Number(e.target.value))}
                className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary-blue"
              />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">0%</span>
                <span className="font-semibold" style={{ color: COLORS.onState }}>
                  {brightness}%
                </span>
                <span className="text-muted">100%</span>
              </div>
            </div>
          </div>

          {/* Current Stats */}
          <div className="glass rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Current Status</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted mb-1">Power</p>
                <p className="text-2xl font-bold text-warning">{formatPower(mockDevice.power)}</p>
              </div>
              <div>
                <p className="text-sm text-muted mb-1">Last Seen</p>
                <p className="text-sm font-medium">{timeAgo(mockDevice.lastSeen)}</p>
              </div>
              <div>
                <p className="text-sm text-muted mb-1">Firmware</p>
                <p className="text-sm font-medium">{mockDevice.firmware}</p>
              </div>
              <div>
                <p className="text-sm text-muted mb-1">MAC Address</p>
                <p className="text-sm font-medium font-mono">{mockDevice.mac}</p>
              </div>
            </div>
          </div>

          {/* Network Info */}
          <div className="glass rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Network Information</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">IP Address</span>
                <span className="font-mono font-medium">{mockDevice.health.ip}</span>
              </div>
              <div className="flex items-center justify-between text-sm border-t border-border pt-3">
                <span className="text-muted">Signal Strength</span>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="w-1.5 h-3 rounded-sm"
                        style={{
                          backgroundColor:
                            i < Math.round(mockDevice.health.signalQuality / 20)
                              ? COLORS.accentTeal
                              : COLORS.border,
                        }}
                      />
                    ))}
                  </div>
                  <span className="font-medium">{mockDevice.health.signalQuality}%</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm border-t border-border pt-3">
                <span className="text-muted">Uptime</span>
                <span className="font-medium">{mockDevice.health.uptime}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="glass rounded-xl p-6">
            <h3 className="font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full px-4 py-2 rounded-lg bg-primary-blue hover:bg-primary-blue-light text-white font-medium transition-colors">
                Edit Device
              </button>
              <button className="w-full px-4 py-2 rounded-lg bg-card-hover hover:bg-card text-foreground font-medium transition-colors border border-border">
                Schedule
              </button>
              <button className="w-full px-4 py-2 rounded-lg bg-card-hover hover:bg-card text-foreground font-medium transition-colors border border-border">
                Automation
              </button>
              <button className="w-full px-4 py-2 rounded-lg hover:bg-red-warn/10 text-red-warn font-medium transition-colors border border-red-warn/30">
                Remove Device
              </button>
            </div>
          </div>

          {/* Device Health */}
          <div className="glass rounded-xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Info size={18} />
              Device Health
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted">CPU Usage</span>
                  <span className="font-medium">{mockDevice.health.cpu}%</span>
                </div>
                <div className="h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-on-state to-gold"
                    style={{ width: `${mockDevice.health.cpu}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted">Memory Usage</span>
                  <span className="font-medium">{mockDevice.health.memory}%</span>
                </div>
                <div className="h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-on-state to-gold"
                    style={{ width: `${mockDevice.health.memory}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
