'use client';

import { useState } from 'react';
import { UserCard } from '@/components/users/UserCard';
import { Plus, Search, Filter } from 'lucide-react';

// Mock users data
const MOCK_USERS = [
  {
    id: '1',
    fullName: 'John Doe',
    email: 'john@example.com',
    role: 'owner' as const,
    status: 'active' as const,
    lastLogin: '5 minutes ago',
    joinedDate: 'Jan 1, 2024',
  },
  {
    id: '2',
    fullName: 'Jane Smith',
    email: 'jane@example.com',
    role: 'admin' as const,
    status: 'active' as const,
    lastLogin: '2 hours ago',
    joinedDate: 'Jan 15, 2024',
  },
  {
    id: '3',
    fullName: 'Mike Wilson',
    email: 'mike@example.com',
    role: 'member' as const,
    status: 'active' as const,
    lastLogin: '1 day ago',
    joinedDate: 'Feb 1, 2024',
  },
  {
    id: '4',
    fullName: 'Sarah Johnson',
    email: 'sarah@example.com',
    role: 'member' as const,
    status: 'inactive' as const,
    lastLogin: '3 weeks ago',
    joinedDate: 'Feb 10, 2024',
  },
  {
    id: '5',
    fullName: 'Tom Brown',
    email: 'tom@example.com',
    role: 'guest' as const,
    status: 'active' as const,
    lastLogin: '12 hours ago',
    joinedDate: 'Feb 20, 2024',
  },
];

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredUsers = MOCK_USERS.filter((user) => {
    const matchesSearch =
      user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const roleCounts = {
    owner: MOCK_USERS.filter((u) => u.role === 'owner').length,
    admin: MOCK_USERS.filter((u) => u.role === 'admin').length,
    member: MOCK_USERS.filter((u) => u.role === 'member').length,
    guest: MOCK_USERS.filter((u) => u.role === 'guest').length,
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100 mb-2">User Management</h1>
        <p className="text-slate-400">Manage home access and user permissions</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <div className="rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-4 backdrop-blur-sm">
          <p className="text-sm text-slate-400">Total Users</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">{MOCK_USERS.length}</p>
        </div>

        <div className="rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-4 backdrop-blur-sm">
          <p className="text-sm text-slate-400">Owners</p>
          <p className="text-2xl font-bold text-purple-400 mt-1">{roleCounts.owner}</p>
        </div>

        <div className="rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-4 backdrop-blur-sm">
          <p className="text-sm text-slate-400">Admins</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{roleCounts.admin}</p>
        </div>

        <div className="rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-4 backdrop-blur-sm">
          <p className="text-sm text-slate-400">Members</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{roleCounts.member}</p>
        </div>

        <div className="rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-4 backdrop-blur-sm">
          <p className="text-sm text-slate-400">Active Users</p>
          <p className="text-2xl font-bold text-green-400 mt-1">
            {MOCK_USERS.filter((u) => u.status === 'active').length}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-slate-800 transition-all"
            />
          </div>

          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Invite User
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500/50 transition-all"
          >
            <option value="all">All Roles</option>
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="guest">Guest</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500/50 transition-all"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map((user) => (
          <UserCard
            key={user.id}
            {...user}
            onEdit={() => console.log(`[v0] Edit user: ${user.id}`)}
            onDelete={() => console.log(`[v0] Delete user: ${user.id}`)}
          />
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400">No users found matching your filters</p>
        </div>
      )}

      {/* Role Information */}
      <div className="mt-8 rounded-lg border border-slate-700/50 bg-gradient-to-br from-blue-500/5 to-blue-500/0 p-6 backdrop-blur-sm">
        <h3 className="font-semibold text-slate-100 mb-4">Role Permissions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="font-medium text-purple-400 mb-2">Owner</p>
            <ul className="text-slate-400 space-y-1">
              <li>Full home access</li>
              <li>Manage users</li>
              <li>Edit automations</li>
              <li>Billing access</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-red-400 mb-2">Admin</p>
            <ul className="text-slate-400 space-y-1">
              <li>Full device control</li>
              <li>Create scenes</li>
              <li>Manage automations</li>
              <li>View reports</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-blue-400 mb-2">Member</p>
            <ul className="text-slate-400 space-y-1">
              <li>Control devices</li>
              <li>Activate scenes</li>
              <li>View status</li>
              <li>Notifications</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-slate-400 mb-2">Guest</p>
            <ul className="text-slate-400 space-y-1">
              <li>View devices</li>
              <li>Limited control</li>
              <li>No settings</li>
              <li>Temporary access</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
