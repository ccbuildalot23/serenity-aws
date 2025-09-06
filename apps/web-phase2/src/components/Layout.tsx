'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  Calendar, 
  Activity, 
  MessageSquare, 
  Users, 
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  Heart,
  BarChart3,
  AlertCircle,
  DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';

const patientNavItems = [
  { href: '/patient/dashboard', label: 'Dashboard', icon: Home },
  { href: '/patient/check-in', label: 'Daily Check-in', icon: Calendar },
  { href: '/patient/assessments', label: 'Assessments', icon: Activity },
  { href: '/patient/ai-support', label: 'AI Support', icon: MessageSquare },
];

const providerNavItems = [
  { href: '/provider/dashboard', label: 'Dashboard', icon: Home },
  { href: '/provider/patients', label: 'Patients', icon: Users },
  { href: '/provider/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/provider/plans', label: 'Pricing & Plans', icon: DollarSign },
];

const supporterNavItems = [
  { href: '/supporter/alerts', label: 'Alerts', icon: Bell },
  { href: '/supporter/dashboard', label: 'Dashboard', icon: Home },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, sidebarOpen, toggleSidebar } = useStore();
  
  // Determine which nav items to show based on user role
  let navItems = patientNavItems;
  if (user?.role === 'provider') navItems = providerNavItems;
  if (user?.role === 'supporter') navItems = supporterNavItems;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 w-full bg-white/90 backdrop-blur-sm border-b z-50">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="flex items-center gap-2">
            <Heart className="text-purple-600" size={24} />
            <span className="font-bold text-xl">Serenity</span>
          </div>
          <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors relative">
            <Bell size={24} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
        </div>
      </header>

      <div className="flex h-screen pt-16 lg:pt-0">
        {/* Sidebar */}
        <aside
          className={cn(
            'fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r transition-transform duration-300',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          )}
        >
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="p-6 border-b">
              <div className="flex items-center gap-3">
                <Heart className="text-purple-600" size={32} />
                <div>
                  <h1 className="font-bold text-xl">Serenity</h1>
                  <p className="text-xs text-gray-500">Phase 2 Demo</p>
                </div>
              </div>
            </div>

            {/* User Info */}
            {user && (
              <div className="p-4 border-b">
                <div className="text-sm">
                  <p className="font-medium">{user.name || user.email}</p>
                  <p className="text-gray-500 capitalize">{user.role}</p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <nav className="flex-1 p-4">
              <ul className="space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                          isActive
                            ? 'bg-purple-100 text-purple-700'
                            : 'hover:bg-gray-100 text-gray-700'
                        )}
                      >
                        <Icon size={20} />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Bottom Actions */}
            <div className="p-4 border-t">
              <Link
                href="/settings"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors"
              >
                <Settings size={20} />
                <span>Settings</span>
              </Link>
              <button
                onClick={() => {
                  // Handle logout
                  useStore.getState().reset();
                  window.location.href = '/login';
                }}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors w-full"
              >
                <LogOut size={20} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={toggleSidebar}
        />
      )}
    </div>
  );
}