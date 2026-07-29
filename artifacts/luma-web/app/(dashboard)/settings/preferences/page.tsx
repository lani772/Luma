'use client';

import { useState } from 'react';
import { Bell, Eye, Volume2, Clock, Zap, AlertCircle } from 'lucide-react';

interface PreferenceToggle {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  icon?: React.ReactNode;
}

export default function PreferencesPage() {
  const [preferences, setPreferences] = useState({
    notifications: {
      email: true,
      push: true,
      deviceOffline: true,
      energyThreshold: false,
      scheduledReports: true,
    },
    display: {
      theme: 'dark',
      compactView: false,
      showTemperature: true,
      showEnergyMetrics: true,
      language: 'en',
    },
    automation: {
      autoOptimize: true,
      learningMode: true,
      suggestOptimization: true,
    },
  });

  const toggleNotification = (key: keyof typeof preferences.notifications) => {
    setPreferences((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: !prev.notifications[key],
      },
    }));
  };

  const toggleAutomation = (key: keyof typeof preferences.automation) => {
    setPreferences((prev) => ({
      ...prev,
      automation: {
        ...prev.automation,
        [key]: !prev.automation[key],
      },
    }));
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Preferences</h1>
        <p className="text-slate-400">Customize your home automation experience</p>
      </div>

      {/* Notifications Preferences */}
      <div className="mb-8 rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-6 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-lg bg-blue-500/10">
            <Bell className="w-6 h-6 text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-100">Notification Preferences</h2>
        </div>

        <div className="space-y-4">
          {[
            {
              key: 'email',
              label: 'Email Notifications',
              description: 'Receive important updates via email',
            },
            {
              key: 'push',
              label: 'Push Notifications',
              description: 'Get alerts on your devices',
            },
            {
              key: 'deviceOffline',
              label: 'Device Offline Alerts',
              description: 'Notify when devices go offline',
            },
            {
              key: 'energyThreshold',
              label: 'Energy Threshold Alerts',
              description: 'Alert when energy usage exceeds threshold',
            },
            {
              key: 'scheduledReports',
              label: 'Scheduled Reports',
              description: 'Weekly or monthly usage reports',
            },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between p-4 rounded-lg border border-slate-700/30 bg-slate-800/20">
              <div>
                <h4 className="font-medium text-slate-100">{item.label}</h4>
                <p className="text-sm text-slate-400 mt-1">{item.description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={preferences.notifications[item.key as keyof typeof preferences.notifications]}
                  onChange={() =>
                    toggleNotification(item.key as keyof typeof preferences.notifications)
                  }
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Display Preferences */}
      <div className="mb-8 rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-6 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-lg bg-cyan-500/10">
            <Eye className="w-6 h-6 text-cyan-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-100">Display Preferences</h2>
        </div>

        <div className="space-y-4">
          {/* Theme */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Theme</label>
            <select
              value={preferences.display.theme}
              onChange={(e) =>
                setPreferences((prev) => ({
                  ...prev,
                  display: { ...prev.display, theme: e.target.value },
                }))
              }
              className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500/50 transition-all"
            >
              <option value="dark">Dark Mode</option>
              <option value="light">Light Mode</option>
              <option value="auto">Auto (System)</option>
            </select>
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Language</label>
            <select
              value={preferences.display.language}
              onChange={(e) =>
                setPreferences((prev) => ({
                  ...prev,
                  display: { ...prev.display, language: e.target.value },
                }))
              }
              className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500/50 transition-all"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
          </div>

          {/* Toggles */}
          {[
            {
              key: 'compactView',
              label: 'Compact View',
              description: 'Show more information in less space',
            },
            {
              key: 'showTemperature',
              label: 'Show Temperature',
              description: 'Display temperature readings throughout the app',
            },
            {
              key: 'showEnergyMetrics',
              label: 'Show Energy Metrics',
              description: 'Display power usage and energy statistics',
            },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between p-4 rounded-lg border border-slate-700/30 bg-slate-800/20">
              <div>
                <h4 className="font-medium text-slate-100">{item.label}</h4>
                <p className="text-sm text-slate-400 mt-1">{item.description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={preferences.display[item.key as keyof typeof preferences.display] as boolean}
                  onChange={(e) =>
                    setPreferences((prev) => ({
                      ...prev,
                      display: {
                        ...prev.display,
                        [item.key]: e.target.checked,
                      },
                    }))
                  }
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Automation Preferences */}
      <div className="rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-6 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-lg bg-green-500/10">
            <Zap className="w-6 h-6 text-green-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-100">Automation Preferences</h2>
        </div>

        <div className="space-y-4">
          {[
            {
              key: 'autoOptimize',
              label: 'Auto Optimize',
              description: 'Automatically optimize device performance and energy usage',
            },
            {
              key: 'learningMode',
              label: 'Learning Mode',
              description: 'Let the system learn your habits and suggest automations',
            },
            {
              key: 'suggestOptimization',
              label: 'Suggest Optimization',
              description: 'Receive suggestions to improve energy efficiency',
            },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between p-4 rounded-lg border border-slate-700/30 bg-slate-800/20">
              <div>
                <h4 className="font-medium text-slate-100">{item.label}</h4>
                <p className="text-sm text-slate-400 mt-1">{item.description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={preferences.automation[item.key as keyof typeof preferences.automation]}
                  onChange={() =>
                    toggleAutomation(item.key as keyof typeof preferences.automation)
                  }
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
            Save Preferences
          </button>
          <button className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg font-medium transition-colors">
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}
