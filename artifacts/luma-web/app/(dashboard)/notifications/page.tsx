'use client';

import { useState } from 'react';
import { AlertCircle, Info, CheckCircle, Zap, Trash2, Filter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  type: 'alert' | 'info' | 'success' | 'warning';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'alert',
    title: 'Device Offline',
    message: 'Living Room Light has gone offline',
    timestamp: new Date(Date.now() - 5 * 60000),
    read: false,
  },
  {
    id: '2',
    type: 'warning',
    title: 'High Energy Usage',
    message: 'Your home is using 2.5 kW, 15% above average',
    timestamp: new Date(Date.now() - 30 * 60000),
    read: false,
  },
  {
    id: '3',
    type: 'success',
    title: 'Scene Activated',
    message: 'Good Night scene activated successfully',
    timestamp: new Date(Date.now() - 2 * 3600000),
    read: true,
  },
  {
    id: '4',
    type: 'info',
    title: 'Device Update Available',
    message: 'Kitchen Smart Display has a new firmware update',
    timestamp: new Date(Date.now() - 24 * 3600000),
    read: true,
  },
  {
    id: '5',
    type: 'success',
    title: 'Device Connected',
    message: 'New device "Bedroom Smart Plug" connected',
    timestamp: new Date(Date.now() - 48 * 3600000),
    read: true,
  },
];

const typeStyles = {
  alert: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', icon: AlertCircle },
  warning: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-400', icon: Zap },
  success: { bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-400', icon: CheckCircle },
  info: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', icon: Info },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [filter, setFilter] = useState('all');

  const filteredNotifications = notifications.filter((notif) => {
    if (filter === 'unread') return !notif.read;
    if (filter === 'alert') return notif.type === 'alert';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((notif) => (notif.id === id ? { ...notif, read: true } : notif))
    );
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((notif) => notif.id !== id));
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Notifications</h1>
          <p className="text-slate-400">{unreadCount} new notifications</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Mark All as Read
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="mb-6 flex gap-2">
        {[
          { value: 'all', label: 'All' },
          { value: 'unread', label: `Unread (${unreadCount})` },
          { value: 'alert', label: 'Alerts' },
        ].map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === option.value
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800/50 border border-slate-700/50 text-slate-300 hover:border-slate-600'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((notification) => {
            const style = typeStyles[notification.type];
            const Icon = style.icon;

            return (
              <div
                key={notification.id}
                className={`rounded-lg border p-4 backdrop-blur-sm transition-all ${
                  notification.read
                    ? `${style.bg} ${style.border} opacity-60`
                    : `${style.bg} ${style.border} border-opacity-100`
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${style.bg} ${style.text}`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-1">
                      <h3 className={`font-semibold ${style.text}`}>{notification.title}</h3>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-current mt-2"></div>
                      )}
                    </div>
                    <p className="text-sm text-slate-300 mb-2">{notification.message}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">
                        {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                      </span>
                      <div className="flex gap-2">
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-xs px-3 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded transition-colors"
                          >
                            Mark Read
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="p-1 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12">
            <p className="text-slate-400">No notifications to display</p>
          </div>
        )}
      </div>
    </div>
  );
}
