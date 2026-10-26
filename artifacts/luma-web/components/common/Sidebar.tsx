'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { COLORS } from '@/lib/colors';
import { generateInitials } from '@/lib/utils';
import {
  Home, Zap, Lightbulb, Users, Settings, LogOut, Menu, X,
  Activity, Bell, BarChart3, Waves
} from 'lucide-react';

const mainNav = [
  { label: 'Dashboard', href: '/', icon: Home },
  { label: 'Devices', href: '/devices', icon: Lightbulb },
  { label: 'Energy', href: '/energy', icon: Zap },
  { label: 'Rooms', href: '/rooms', icon: Waves },
  { label: 'Scenes', href: '/scenes', icon: BarChart3 },
];

const adminNav = [
  { label: 'Users', href: '/users', icon: Users },
  { label: 'Activity', href: '/activity', icon: Activity },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    await logout();
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={isOpen}
        aria-controls="sidebar-navigation"
        className="fixed top-4 left-4 z-40 md:hidden p-2 hover:bg-card rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-blue"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        id="sidebar-navigation"
        className={`fixed left-0 top-0 h-screen w-64 bg-card border-r border-border transform transition-transform duration-200 ease-out z-30 md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:relative`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-border">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary-blue flex items-center justify-center">
                <span className="text-lg font-bold text-white">⚡</span>
              </div>
              <div>
                <div className="font-bold text-foreground">LUMA</div>
                <div className="text-xs text-muted">Smart Home</div>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {mainNav.map(item => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors duration-200 ${
                    active
                      ? 'bg-primary-blue/20 text-primary-blue'
                      : 'text-muted hover:text-foreground hover:bg-card-hover'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}

            {isAdmin && (
              <>
                <div className="px-4 py-2 text-xs font-semibold text-muted uppercase mt-4 mb-2">
                  Admin
                </div>
                {adminNav.map(item => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors duration-200 ${
                        active
                          ? 'bg-primary-blue/20 text-primary-blue'
                          : 'text-muted hover:text-foreground hover:bg-card-hover'
                      }`}
                    >
                      <Icon size={20} />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </>
            )}
          </nav>

          {/* User Profile & Logout */}
          <div className="p-4 border-t border-border space-y-3">
            <Link
              href="/settings"
              className="flex items-center gap-3 px-4 py-2 rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <Settings size={20} />
              <span className="font-medium">Settings</span>
            </Link>

            {user && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-card-hover border border-border">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                  style={{ backgroundColor: COLORS.primaryBlue }}
                >
                  {generateInitials(user.fullName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{user.fullName}</div>
                  <div className="text-xs text-muted truncate">{user.email}</div>
                </div>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-red-warn hover:bg-red-warn/10 transition-colors font-medium"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
