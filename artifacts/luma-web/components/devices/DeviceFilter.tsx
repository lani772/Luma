'use client';

import { Search } from 'lucide-react';

interface DeviceFilterProps {
  query: string;
  onQueryChange: (query: string) => void;
  statusFilter: 'all' | 'on' | 'off' | 'offline';
  onStatusChange: (status: 'all' | 'on' | 'off' | 'offline') => void;
  roomFilter: string;
  onRoomChange: (room: string) => void;
  rooms: string[];
}

const statusOptions = [
  { value: 'all', label: 'All Devices' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
  { value: 'offline', label: 'Offline' },
];

export function DeviceFilter({
  query,
  onQueryChange,
  statusFilter,
  onStatusChange,
  roomFilter,
  onRoomChange,
  rooms,
}: DeviceFilterProps) {
  return (
    <div className="glass rounded-xl p-4 space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
        <input
          type="text"
          placeholder="Search devices..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="input pl-10"
        />
      </div>

      {/* Status Filter */}
      <div>
        <label className="text-sm font-medium mb-2 block">Status</label>
        <div className="flex gap-2 flex-wrap">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onStatusChange(option.value as any)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === option.value
                  ? 'bg-primary-blue text-white'
                  : 'bg-card-hover text-muted hover:text-foreground'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Room Filter */}
      {rooms.length > 0 && (
        <div>
          <label className="text-sm font-medium mb-2 block">Room</label>
          <select
            value={roomFilter}
            onChange={(e) => onRoomChange(e.target.value)}
            className="input"
          >
            <option value="all">All Rooms</option>
            {rooms.map((room) => (
              <option key={room} value={room}>
                {room}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
