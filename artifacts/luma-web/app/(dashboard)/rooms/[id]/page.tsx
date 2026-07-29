'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BarChart3,
  Zap,
  Lightbulb,
  Thermometer,
  Droplets,
  Settings,
} from 'lucide-react';
import { DeviceCard } from '@/components/devices/DeviceCard';

// Mock room detail data
const ROOM_DATA = {
  '1': {
    name: 'Living Room',
    temperature: 22,
    humidity: 45,
    powerUsage: 450,
    devices: [
      {
        id: 'light-1',
        name: 'Ceiling Light',
        type: 'light',
        status: 'on',
        brightness: 80,
        room: 'Living Room',
      },
      {
        id: 'fan-1',
        name: 'Ceiling Fan',
        type: 'fan',
        status: 'on',
        room: 'Living Room',
      },
      {
        id: 'tv-1',
        name: 'Smart TV',
        type: 'entertainment',
        status: 'on',
        room: 'Living Room',
      },
      {
        id: 'ac-1',
        name: 'Air Conditioner',
        type: 'thermostat',
        status: 'off',
        temperature: 22,
        room: 'Living Room',
      },
    ],
  },
  '2': {
    name: 'Kitchen',
    temperature: 21,
    humidity: 52,
    powerUsage: 280,
    devices: [
      {
        id: 'light-2',
        name: 'Kitchen Lights',
        type: 'light',
        status: 'on',
        brightness: 100,
        room: 'Kitchen',
      },
      {
        id: 'fridge-1',
        name: 'Smart Fridge',
        type: 'appliance',
        status: 'on',
        room: 'Kitchen',
      },
    ],
  },
};

export default function RoomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  // Get room data with fallback
  const room = ROOM_DATA[roomId as keyof typeof ROOM_DATA] || ROOM_DATA['1'];

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-100">{room.name}</h1>
          <p className="text-slate-400">{room.devices.length} devices</p>
        </div>
      </div>

      {/* Room Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <Thermometer className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-slate-400">Temperature</span>
          </div>
          <p className="text-2xl font-bold text-slate-100">{room.temperature}°C</p>
        </div>

        <div className="rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <Droplets className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-slate-400">Humidity</span>
          </div>
          <p className="text-2xl font-bold text-slate-100">{room.humidity}%</p>
        </div>

        <div className="rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-slate-400">Power Usage</span>
          </div>
          <p className="text-2xl font-bold text-slate-100">{room.powerUsage}W</p>
        </div>

        <div className="rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-green-400" />
            <span className="text-xs text-slate-400">Devices Online</span>
          </div>
          <p className="text-2xl font-bold text-slate-100">
            {room.devices.filter((d) => d.status === 'on').length}/{room.devices.length}
          </p>
        </div>
      </div>

      {/* Room Controls */}
      <div className="flex gap-3 mb-8">
        <button className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-300 hover:border-slate-600 transition-colors flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          Turn All On
        </button>
        <button className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-300 hover:border-slate-600 transition-colors">
          Turn All Off
        </button>
        <button className="ml-auto px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-300 hover:border-slate-600 transition-colors flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Room Settings
        </button>
      </div>

      {/* Devices in Room */}
      <div>
        <h2 className="text-xl font-semibold text-slate-100 mb-4">Devices</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {room.devices.map((device) => (
            <DeviceCard
              key={device.id}
              {...device}
              onClick={() => router.push(`/devices/${device.id}`)}
            />
          ))}
        </div>
      </div>

      {room.devices.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400">No devices in this room</p>
        </div>
      )}
    </div>
  );
}
