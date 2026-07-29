'use client';

import { useState } from 'react';
import { ActivityLog } from '@/components/common/ActivityLog';
import { Search, Filter, Download } from 'lucide-react';

// Mock activity data
const MOCK_ACTIVITY = [
  {
    id: '1',
    type: 'device' as const,
    title: 'Living Room Light Turned On',
    description: 'Ceiling light in living room activated by John',
    timestamp: new Date(Date.now() - 5 * 60000),
    severity: 'low' as const,
  },
  {
    id: '2',
    type: 'scene' as const,
    title: 'Movie Time Scene Activated',
    description: 'All lights dimmed and blinds closed',
    timestamp: new Date(Date.now() - 15 * 60000),
    severity: 'low' as const,
  },
  {
    id: '3',
    type: 'device' as const,
    title: 'Air Conditioner Temperature Set',
    description: 'AC temperature changed to 22°C',
    timestamp: new Date(Date.now() - 30 * 60000),
    severity: 'low' as const,
  },
  {
    id: '4',
    type: 'user' as const,
    title: 'New User Added',
    description: 'Jane Smith (jane@example.com) added as Admin',
    timestamp: new Date(Date.now() - 2 * 3600000),
    severity: 'medium' as const,
  },
  {
    id: '5',
    type: 'security' as const,
    title: 'Security System Armed',
    description: 'Home security armed for night mode',
    timestamp: new Date(Date.now() - 3 * 3600000),
    severity: 'medium' as const,
  },
  {
    id: '6',
    type: 'alert' as const,
    title: 'High Energy Usage Detected',
    description: 'Energy consumption exceeded daily threshold',
    timestamp: new Date(Date.now() - 4 * 3600000),
    severity: 'high' as const,
  },
  {
    id: '7',
    type: 'system' as const,
    title: 'System Updated',
    description: 'LUMA home system updated to v2.5.0',
    timestamp: new Date(Date.now() - 24 * 3600000),
    severity: 'low' as const,
  },
  {
    id: '8',
    type: 'device' as const,
    title: 'Kitchen Lights Turned Off',
    description: 'Automated turn off after 2 hours of inactivity',
    timestamp: new Date(Date.now() - 48 * 3600000),
    severity: 'low' as const,
  },
];

export default function ActivityPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const filteredActivity = MOCK_ACTIVITY.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    const matchesSeverity = severityFilter === 'all' || item.severity === severityFilter;

    return matchesSearch && matchesType && matchesSeverity;
  });

  const typeCounts = {
    device: MOCK_ACTIVITY.filter((a) => a.type === 'device').length,
    scene: MOCK_ACTIVITY.filter((a) => a.type === 'scene').length,
    user: MOCK_ACTIVITY.filter((a) => a.type === 'user').length,
    security: MOCK_ACTIVITY.filter((a) => a.type === 'security').length,
    system: MOCK_ACTIVITY.filter((a) => a.type === 'system').length,
    alert: MOCK_ACTIVITY.filter((a) => a.type === 'alert').length,
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Activity Log</h1>
        <p className="text-slate-400">Track all home automation events and changes</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {[
          { label: 'Devices', count: typeCounts.device, color: 'text-blue-400' },
          { label: 'Scenes', count: typeCounts.scene, color: 'text-yellow-400' },
          { label: 'Users', count: typeCounts.user, color: 'text-purple-400' },
          { label: 'Security', count: typeCounts.security, color: 'text-red-400' },
          { label: 'System', count: typeCounts.system, color: 'text-slate-400' },
          { label: 'Alerts', count: typeCounts.alert, color: 'text-orange-400' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-3 backdrop-blur-sm"
          >
            <p className="text-xs text-slate-400">{stat.label}</p>
            <p className={`text-lg font-bold mt-1 ${stat.color}`}>{stat.count}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search activity..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-slate-800 transition-all"
            />
          </div>

          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500/50 transition-all"
          >
            <option value="all">All Types</option>
            <option value="device">Devices</option>
            <option value="scene">Scenes</option>
            <option value="user">Users</option>
            <option value="security">Security</option>
            <option value="system">System</option>
            <option value="alert">Alerts</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500/50 transition-all"
          >
            <option value="all">All Severity</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      {/* Activity List */}
      <div>
        <ActivityLog items={filteredActivity} />
      </div>

      {filteredActivity.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400">No activity found matching your filters</p>
        </div>
      )}

      {/* Information Box */}
      <div className="mt-8 rounded-lg border border-slate-700/50 bg-gradient-to-br from-blue-500/5 to-blue-500/0 p-6 backdrop-blur-sm">
        <h3 className="font-semibold text-slate-100 mb-2">Activity Log Information</h3>
        <p className="text-sm text-slate-400">
          The activity log shows all events in your home including device status changes, scene
          activations, user management actions, security events, and system notifications. Export
          the log for record keeping or audit purposes.
        </p>
      </div>
    </div>
  );
}
