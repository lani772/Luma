'use client';

import { useState, useMemo } from 'react';
import { Lamp } from '@/lib/types';
import { DeviceCard } from '@/components/devices/DeviceCard';
import { DeviceFilter } from '@/components/devices/DeviceFilter';
import { Plus } from 'lucide-react';
import Link from 'next/link';

// Mock data - will be replaced with API
const mockDevices: Lamp[] = [
  {
    id: '1',
    name: 'Living Room Lamp',
    room: 'Living Room',
    floor: '1',
    deviceId: 'mqtt-001',
    mac: '00:1A:2B:3C:4D:5E',
    mqttStatus: 'connected',
    online: true,
    lastSeen: Date.now(),
    firmware: '2.1.0',
    on: true,
    brightness: 85,
    colorTemp: 3000,
    rgb: '#FFB347',
    voltage: 220,
    current: 0.5,
    power: 45,
    energyToday: 2.5,
    costToday: 0.75,
    energyMonth: 65.0,
    costMonth: 19.5,
    schedules: [],
    activeTimer: null,
    lastCommand: 'on',
    lastUpdate: Date.now(),
    health: {
      rssi: -45,
      signalQuality: 90,
      ip: '192.168.1.100',
      uptime: '24d 5h',
      restartCount: 2,
      cpu: 35,
      memory: 60,
    },
  },
  {
    id: '2',
    name: 'Kitchen Light',
    room: 'Kitchen',
    floor: '1',
    deviceId: 'mqtt-002',
    mac: '00:1A:2B:3C:4D:5F',
    mqttStatus: 'connected',
    online: true,
    lastSeen: Date.now(),
    firmware: '2.1.0',
    on: false,
    brightness: 0,
    colorTemp: 4000,
    rgb: '#FFFFFF',
    voltage: 220,
    current: 0,
    power: 0,
    energyToday: 0,
    costToday: 0,
    energyMonth: 15.0,
    costMonth: 4.5,
    schedules: [],
    activeTimer: null,
    lastCommand: 'off',
    lastUpdate: Date.now() - 3600000,
    health: {
      rssi: -55,
      signalQuality: 70,
      ip: '192.168.1.101',
      uptime: '12d 3h',
      restartCount: 0,
      cpu: 20,
      memory: 45,
    },
  },
  {
    id: '3',
    name: 'Bedroom Lamp',
    room: 'Bedroom',
    floor: '2',
    deviceId: 'mqtt-003',
    mac: '00:1A:2B:3C:4D:60',
    mqttStatus: 'connected',
    online: true,
    lastSeen: Date.now(),
    firmware: '2.1.0',
    on: true,
    brightness: 50,
    colorTemp: 2700,
    rgb: '#FF8C00',
    voltage: 220,
    current: 0.3,
    power: 30,
    energyToday: 1.8,
    costToday: 0.54,
    energyMonth: 50.0,
    costMonth: 15.0,
    schedules: [],
    activeTimer: { action: 'off', expiresAt: Date.now() + 1800000, label: 'Auto off in 30 min' },
    lastCommand: 'on',
    lastUpdate: Date.now(),
    health: {
      rssi: -50,
      signalQuality: 85,
      ip: '192.168.1.102',
      uptime: '7d 12h',
      restartCount: 1,
      cpu: 25,
      memory: 50,
    },
  },
  {
    id: '4',
    name: 'Office Desk Lamp',
    room: 'Office',
    floor: '2',
    deviceId: 'mqtt-004',
    mac: '00:1A:2B:3C:4D:61',
    mqttStatus: 'disconnected',
    online: false,
    lastSeen: Date.now() - 86400000,
    firmware: '2.0.5',
    on: false,
    brightness: 0,
    colorTemp: 5000,
    rgb: '#FFFFFF',
    voltage: 0,
    current: 0,
    power: 0,
    energyToday: 0,
    costToday: 0,
    energyMonth: 0,
    costMonth: 0,
    schedules: [],
    activeTimer: null,
    lastCommand: 'off',
    lastUpdate: Date.now() - 86400000,
    health: {
      rssi: 0,
      signalQuality: 0,
      ip: '0.0.0.0',
      uptime: 'offline',
      restartCount: 3,
      cpu: 0,
      memory: 0,
    },
  },
];

export default function DevicesPage() {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'on' | 'off' | 'offline'>('all');
  const [roomFilter, setRoomFilter] = useState('all');

  // Get unique rooms
  const rooms = useMemo(() => {
    return [...new Set(mockDevices.map((d) => d.room))].sort();
  }, []);

  // Filter devices
  const filteredDevices = useMemo(() => {
    return mockDevices.filter((device) => {
      // Search query
      if (
        query &&
        !device.name.toLowerCase().includes(query.toLowerCase()) &&
        !device.room.toLowerCase().includes(query.toLowerCase())
      ) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'on' && !device.on) return false;
        if (statusFilter === 'off' && (device.on || !device.online)) return false;
        if (statusFilter === 'offline' && device.online) return false;
      }

      // Room filter
      if (roomFilter !== 'all' && device.room !== roomFilter) return false;

      return true;
    });
  }, [query, statusFilter, roomFilter]);

  const onDevices = mockDevices.filter((d) => d.on).length;
  const totalDevices = mockDevices.length;

  const handleToggle = (id: string, state: boolean) => {
    console.log(`Toggle device ${id} to ${state}`);
    // Will connect to API
  };

  return (
    <div className="flex-1 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Devices</h1>
          <p className="text-muted">
            {filteredDevices.length} of {totalDevices} devices shown
          </p>
        </div>
        <div className="flex gap-2">
          <div className="glass rounded-lg px-4 py-2">
            <span className="text-sm font-medium">{onDevices} ON</span>
          </div>
          <Link
            href="/devices/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-blue hover:bg-primary-blue-light text-white font-medium transition-colors"
          >
            <Plus size={18} />
            Add Device
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters - Sidebar */}
        <div>
          <DeviceFilter
            query={query}
            onQueryChange={setQuery}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            roomFilter={roomFilter}
            onRoomChange={setRoomFilter}
            rooms={rooms}
          />
        </div>

        {/* Device Grid */}
        <div className="lg:col-span-3">
          {filteredDevices.length === 0 ? (
            <div className="glass rounded-xl p-12 text-center">
              <div className="text-muted mb-3">📭</div>
              <p className="font-medium mb-1">No devices found</p>
              <p className="text-sm text-muted">Try adjusting your filters or add a new device</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDevices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
