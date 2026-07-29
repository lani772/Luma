'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sofa,
  Utensils,
  Bed,
  Lightbulb,
  Trees,
  Bath,
  Plus,
  Search,
  Settings,
} from 'lucide-react';
import { RoomCard } from '@/components/rooms/RoomCard';

// Mock room data
const MOCK_ROOMS = [
  {
    id: '1',
    name: 'Living Room',
    icon: Sofa,
    deviceCount: 8,
    activeDevices: 6,
    temperature: 22,
    humidity: 45,
    powerUsage: 450,
  },
  {
    id: '2',
    name: 'Kitchen',
    icon: Utensils,
    deviceCount: 5,
    activeDevices: 3,
    temperature: 21,
    humidity: 52,
    powerUsage: 280,
  },
  {
    id: '3',
    name: 'Bedroom',
    icon: Bed,
    deviceCount: 4,
    activeDevices: 2,
    temperature: 20,
    humidity: 48,
    powerUsage: 120,
  },
  {
    id: '4',
    name: 'Study',
    icon: Lightbulb,
    deviceCount: 6,
    activeDevices: 5,
    temperature: 23,
    humidity: 42,
    powerUsage: 320,
  },
  {
    id: '5',
    name: 'Backyard',
    icon: Trees,
    deviceCount: 3,
    activeDevices: 1,
    temperature: 19,
    humidity: 65,
    powerUsage: 80,
  },
  {
    id: '6',
    name: 'Bathroom',
    icon: Bath,
    deviceCount: 2,
    activeDevices: 0,
    temperature: 24,
    humidity: 72,
    powerUsage: 0,
  },
];

export default function RoomsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');

  const filteredRooms = MOCK_ROOMS.filter((room) =>
    room.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    } else if (sortBy === 'active') {
      return b.activeDevices - a.activeDevices;
    } else if (sortBy === 'devices') {
      return b.deviceCount - a.deviceCount;
    }
    return 0;
  });

  const totalDevices = MOCK_ROOMS.reduce((acc, room) => acc + room.deviceCount, 0);
  const activeDevices = MOCK_ROOMS.reduce((acc, room) => acc + room.activeDevices, 0);
  const totalPower = MOCK_ROOMS.reduce((acc, room) => acc + (room.powerUsage || 0), 0);

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Rooms</h1>
        <p className="text-slate-400">Manage your home rooms and their devices</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Total Rooms</p>
              <p className="text-2xl font-bold text-slate-100 mt-1">
                {MOCK_ROOMS.length}
              </p>
            </div>
            <div className="text-3xl opacity-30">🏠</div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Active Devices</p>
              <p className="text-2xl font-bold text-green-400 mt-1">
                {activeDevices}/{totalDevices}
              </p>
            </div>
            <div className="text-3xl opacity-30">⚡</div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Power Usage</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{totalPower}W</p>
            </div>
            <div className="text-3xl opacity-30">⚙</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search rooms..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-slate-800 transition-all"
          />
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500/50 transition-all"
        >
          <option value="name">Sort by Name</option>
          <option value="active">Sort by Active Devices</option>
          <option value="devices">Sort by Total Devices</option>
        </select>

        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Room
        </button>
      </div>

      {/* Rooms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRooms.map((room) => (
          <RoomCard
            key={room.id}
            {...room}
            onClick={() => router.push(`/rooms/${room.id}`)}
          />
        ))}
      </div>

      {filteredRooms.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400">No rooms found</p>
        </div>
      )}
    </div>
  );
}
