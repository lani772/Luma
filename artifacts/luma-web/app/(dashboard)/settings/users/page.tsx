'use client';

import { useState } from 'react';
import { Plus, Search, Filter, Mail, Shield } from 'lucide-react';
import { UserCard } from '@/components/users/UserCard';

// Mock users data
const MOCK_USERS = [
  {
    id: '1',
    fullName: 'John Doe',
    email: 'john@example.com',
    role: 'owner' as const,
    status: 'active' as const,
    joinedDate: 'Jan 15, 2024',
    lastLogin: '2 hours ago',
  },
  {
    id: '2',
    fullName: 'Jane Smith',
    email: 'jane@example.com',
    role: 'admin' as const,
    status: 'active' as const,
    joinedDate: 'Feb 1, 2024',
    lastLogin: '30 minutes ago',
  },
  {
    id: '3',
    fullName: 'Mike Johnson',
    email: 'mike@example.com',
    role: 'member' as const,
    status: 'active' as const,
    joinedDate: 'Feb 15, 2024',
    lastLogin: '1 day ago',
  },
  {
    id: '4',
    fullName: 'Sarah Wilson',
    email: 'sarah@example.com',
    role: 'member' as const,
    status: 'inactive' as const,
    joinedDate: 'Mar 1, 2024',
    lastLogin: '2 weeks ago',
  },
  {
    id: '5',
    fullName: 'Tom Brown',
    email: 'tom@example.com',
    role: 'guest' as const,
    status: 'active' as const,
    joinedDate: 'Mar 10, 2024',
    lastLogin: '3 days ago',
  },
];

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredUsers = MOCK_USERS.filter((user) => {
    const matchesSearch =
      user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const stats = {
    total: MOCK_USERS.length,
    active: MOCK_USERS.filter((u) => u.status === 'active').length,
    admins: MOCK_USERS.filter((u) => u.role === 'admin' || u.role === 'owner').length,
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100 mb-2">User Management</h1>
        <p className="text-slate-400">Manage users and their access permissions</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Total Users</p>
              <p className="text-2xl font-bold text-slate-100 mt-1">{stats.total}</p>
            </div>
            <div className="text-3xl opacity-30">👥</div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Active Users</p>
              <p className="text-2xl font-bold text-green-400 mt-1">{stats.active}</p>
            </div>
            <div className="text-3xl opacity-30">✓</div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Admins</p>
              <p className="text-2xl font-bold text-purple-400 mt-1">{stats.admins}</p>
            </div>
            <div className="text-3xl opacity-30">👑</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col lg:flex-row gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-slate-800 transition-all"
          />
        </div>

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

        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap">
          <Plus className="w-4 h-4" />
          Invite User
        </button>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map((user) => (
          <UserCard
            key={user.id}
            {...user}
            onEdit={() => console.log('Edit user:', user.id)}
            onDelete={() => console.log('Delete user:', user.id)}
          />
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400">No users found</p>
        </div>
      )}

      {/* Role Reference Card */}
      <div className="mt-8 rounded-lg border border-slate-700/50 bg-gradient-to-br from-blue-500/5 to-blue-500/0 p-6 backdrop-blur-sm">
        <h3 className="font-semibold text-slate-100 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-400" />
          Role Permissions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              role: 'Owner',
              permissions: ['Full control', 'Manage users', 'Delete home'],
            },
            {
              role: 'Admin',
              permissions: ['Manage devices', 'Create scenes', 'Edit settings'],
            },
            {
              role: 'Member',
              permissions: ['Control devices', 'View analytics', 'Limited access'],
            },
            {
              role: 'Guest',
              permissions: ['View-only', 'No modifications', 'Temporary access'],
            },
          ].map((item) => (
            <div
              key={item.role}
              className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/30"
            >
              <h4 className="font-medium text-slate-100 mb-2">{item.role}</h4>
              <ul className="text-xs text-slate-400 space-y-1">
                {item.permissions.map((perm) => (
                  <li key={perm}>• {perm}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
