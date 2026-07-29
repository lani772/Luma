'use client';

import { useState } from 'react';
import { Lock, Eye, EyeOff, Shield, Smartphone, LogOut } from 'lucide-react';

export default function SecuritySettingsPage() {
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  const handlePasswordChange = (field: string, value: string) => {
    setPasswords((prev) => ({ ...prev, [field]: value }));
  };

  const handleChangePassword = async () => {
    console.log('[v0] Changing password');
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Security Settings</h1>
        <p className="text-slate-400">Protect your account and data</p>
      </div>

      {/* Two-Factor Authentication */}
      <div className="mb-8 rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-6 backdrop-blur-sm">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-purple-500/10">
              <Smartphone className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Two-Factor Authentication</h3>
              <p className="text-sm text-slate-400 mt-1">Add an extra layer of security to your account</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
            <div className="w-2 h-2 rounded-full bg-orange-400"></div>
            <span className="text-xs font-medium text-orange-400">Disabled</span>
          </div>
        </div>
        <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors">
          Enable 2FA
        </button>
      </div>

      {/* Change Password */}
      <div className="mb-8 rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-6 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-lg bg-blue-500/10">
            <Lock className="w-6 h-6 text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-100">Change Password</h3>
        </div>

        <div className="space-y-4">
          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Current Password</label>
            <div className="relative">
              <input
                type={showPasswords.current ? 'text' : 'password'}
                value={passwords.current}
                onChange={(e) => handlePasswordChange('current', e.target.value)}
                className="w-full px-4 py-2 pr-10 rounded-lg border border-slate-700/50 bg-slate-800/30 text-slate-100 focus:border-blue-500/50 focus:bg-slate-800 transition-all"
              />
              <button
                onClick={() =>
                  setShowPasswords((prev) => ({ ...prev, current: !prev.current }))
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPasswords.current ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">New Password</label>
            <div className="relative">
              <input
                type={showPasswords.new ? 'text' : 'password'}
                value={passwords.new}
                onChange={(e) => handlePasswordChange('new', e.target.value)}
                className="w-full px-4 py-2 pr-10 rounded-lg border border-slate-700/50 bg-slate-800/30 text-slate-100 focus:border-blue-500/50 focus:bg-slate-800 transition-all"
              />
              <button
                onClick={() => setShowPasswords((prev) => ({ ...prev, new: !prev.new }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPasswords.new ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">Min 8 characters, includes uppercase, lowercase, and numbers</p>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Confirm Password</label>
            <div className="relative">
              <input
                type={showPasswords.confirm ? 'text' : 'password'}
                value={passwords.confirm}
                onChange={(e) => handlePasswordChange('confirm', e.target.value)}
                className="w-full px-4 py-2 pr-10 rounded-lg border border-slate-700/50 bg-slate-800/30 text-slate-100 focus:border-blue-500/50 focus:bg-slate-800 transition-all"
              />
              <button
                onClick={() =>
                  setShowPasswords((prev) => ({ ...prev, confirm: !prev.confirm }))
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPasswords.confirm ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleChangePassword}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Update Password
          </button>
          <button className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg font-medium transition-colors">
            Cancel
          </button>
        </div>
      </div>

      {/* Login Sessions */}
      <div className="mb-8 rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-6 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-lg bg-green-500/10">
            <Shield className="w-6 h-6 text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-100">Active Sessions</h3>
        </div>

        <div className="space-y-4">
          {[
            {
              device: 'MacBook Pro',
              location: 'San Francisco, CA',
              browser: 'Chrome',
              lastActive: 'Now',
              isCurrent: true,
            },
            {
              device: 'iPhone 14',
              location: 'San Francisco, CA',
              browser: 'Safari',
              lastActive: '2 hours ago',
              isCurrent: false,
            },
            {
              device: 'Desktop PC',
              location: 'San Francisco, CA',
              browser: 'Firefox',
              lastActive: '3 days ago',
              isCurrent: false,
            },
          ].map((session, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 rounded-lg border border-slate-700/30 bg-slate-800/20"
            >
              <div className="flex-1">
                <h4 className="font-medium text-slate-100">
                  {session.device}
                  {session.isCurrent && (
                    <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                      Current
                    </span>
                  )}
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  {session.location} • {session.browser} • {session.lastActive}
                </p>
              </div>
              {!session.isCurrent && (
                <button className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors">
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <button className="mt-6 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/20 rounded-lg font-medium transition-colors flex items-center gap-2">
          <LogOut className="w-4 h-4" />
          Logout All Other Sessions
        </button>
      </div>

      {/* Account Deletion */}
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-6">
        <h3 className="text-lg font-semibold text-red-400 mb-2">Danger Zone</h3>
        <p className="text-sm text-slate-400 mb-4">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors">
          Delete Account
        </button>
      </div>
    </div>
  );
}
