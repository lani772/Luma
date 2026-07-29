'use client';

import { useAuth } from '@/context/AuthContext';
import { StatCard } from '@/components/dashboard/StatCard';
import { getGreeting, getCurrentDate, formatPower, formatEnergy } from '@/lib/utils';
import { COLORS, SCENE_COLORS } from '@/lib/colors';
import { Zap, Wifi, Activity, Sun } from 'lucide-react';
import Link from 'next/link';

// Mock data - will be replaced with real data from API
const mockDevices = [
  { id: '1', name: 'Living Room Lamp', on: true, online: true, power: 45, room: 'Living Room' },
  { id: '2', name: 'Kitchen Light', on: false, online: true, power: 0, room: 'Kitchen' },
  { id: '3', name: 'Bedroom Lamp', on: true, online: true, power: 60, room: 'Bedroom' },
];

const mockScenes = [
  { id: 'morning', name: 'Morning', emoji: '🌅', color: SCENE_COLORS.morning, active: false },
  { id: 'movie', name: 'Movie', emoji: '🎬', color: SCENE_COLORS.movie, active: false },
  { id: 'reading', name: 'Reading', emoji: '📖', color: SCENE_COLORS.reading, active: false },
  { id: 'sleep', name: 'Sleep', emoji: '🌙', color: SCENE_COLORS.sleep, active: false },
];

const mockRooms = [
  { id: '1', name: 'Living Room', emoji: '🛋️', devices: 3, active: 2 },
  { id: '2', name: 'Kitchen', emoji: '🍳', devices: 2, active: 1 },
  { id: '3', name: 'Bedroom', emoji: '🛏️', devices: 2, active: 1 },
  { id: '4', name: 'Office', emoji: '💻', devices: 3, active: 2 },
];

const mockActivity = [
  { id: '1', type: 'device', message: 'Living Room Lamp turned on', time: '5 minutes ago' },
  { id: '2', type: 'scene', message: 'Morning scene activated', time: '2 hours ago' },
  { id: '3', type: 'device', message: 'Bedroom Lamp brightness changed', time: '1 hour ago' },
  { id: '4', type: 'login', message: 'You signed in from Chrome', time: '8 hours ago' },
];

export default function Dashboard() {
  const { user } = useAuth();

  const activeLamps = mockDevices.filter(d => d.on).length;
  const onlineLamps = mockDevices.filter(d => d.online).length;
  const totalPower = mockDevices.reduce((sum, d) => sum + (d.on ? d.power : 0), 0);
  const totalEnergy = 23.5; // kWh

  const firstName = user?.fullName.split(' ')[0] ?? 'there';

  return (
    <div className="flex-1 p-6 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          {getGreeting()}, {firstName}
        </h1>
        <p className="text-muted">{getCurrentDate()}</p>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Active Devices"
          value={activeLamps}
          icon={Zap}
          color={COLORS.onState}
          subtext={`of ${mockDevices.length} devices`}
        />
        <StatCard
          label="Current Power"
          value={formatPower(totalPower)}
          icon={Activity}
          color={COLORS.warning}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          label="Online Devices"
          value={onlineLamps}
          icon={Wifi}
          color={COLORS.accentTeal}
          subtext={`${Math.round((onlineLamps / mockDevices.length) * 100)}% uptime`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Quick Scenes */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Quick Scenes</h2>
              <Link href="/scenes" className="text-sm text-primary-blue hover:text-primary-blue-light transition-colors">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {mockScenes.map(scene => (
                <button
                  key={scene.id}
                  className="glass rounded-xl p-4 text-center hover:border-primary-blue/50 transition-all group"
                  style={{
                    borderColor: scene.active ? `${scene.color}60` : undefined,
                    backgroundColor: scene.active ? `${scene.color}18` : undefined,
                  }}
                >
                  <div className="text-3xl mb-2">{scene.emoji}</div>
                  <p className="font-medium text-sm" style={{ color: scene.active ? scene.color : 'inherit' }}>
                    {scene.name}
                  </p>
                  {scene.active && (
                    <div
                      className="w-2 h-2 rounded-full mx-auto mt-2"
                      style={{ backgroundColor: scene.color }}
                    />
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Rooms */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Rooms</h2>
              <Link href="/rooms" className="text-sm text-primary-blue hover:text-primary-blue-light transition-colors">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {mockRooms.map(room => (
                <Link
                  key={room.id}
                  href={`/rooms/${room.id}`}
                  className="glass rounded-xl p-4 hover:border-primary-blue/50 transition-all group"
                >
                  <div className="text-3xl mb-2">{room.emoji}</div>
                  <p className="font-medium text-sm mb-2">{room.name}</p>
                  <p className="text-xs text-muted">
                    {room.active}/{room.devices} on
                  </p>
                </Link>
              ))}
            </div>
          </section>

          {/* Energy Summary */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Energy Today</h2>
              <Link href="/energy" className="text-sm text-primary-blue hover:text-primary-blue-light transition-colors">
                View details →
              </Link>
            </div>
            <div className="glass rounded-xl p-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted mb-1">Total Energy</p>
                  <p className="text-2xl font-bold">{formatEnergy(totalEnergy)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted mb-1">Estimated Cost</p>
                  <p className="text-2xl font-bold">$3.52</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div>
          {/* Recent Activity */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Recent Activity</h2>
              <Link href="/activity" className="text-sm text-primary-blue hover:text-primary-blue-light transition-colors">
                View all →
              </Link>
            </div>
            <div className="glass rounded-xl p-4 space-y-3 max-h-96 overflow-y-auto">
              {mockActivity.map(item => (
                <div key={item.id} className="pb-3 border-b border-border last:border-0 last:pb-0">
                  <p className="text-sm font-medium">{item.message}</p>
                  <p className="text-xs text-muted mt-1">{item.time}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Connectivity Status */}
          <section className="mt-6">
            <h3 className="font-semibold mb-3 text-sm">Connectivity</h3>
            <div className="glass rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">MQTT Status</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-on-state"></div>
                  <span className="text-sm font-medium">Connected</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">WiFi</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-on-state"></div>
                  <span className="text-sm font-medium">Strong</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Cloud Sync</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-on-state"></div>
                  <span className="text-sm font-medium">Synced</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
