import { clsx, type ClassValue } from 'clsx';
import { formatDistanceToNow, format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function timeAgo(timestamp: number): string {
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
}

export function formatTime(timestamp: number, fmt = 'MMM d, HH:mm'): string {
  return format(new Date(timestamp), fmt);
}

export function formatDate(timestamp: number): string {
  return format(new Date(timestamp), 'MMM d, yyyy');
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Good Night';
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  if (hour < 21) return 'Good Evening';
  return 'Good Night';
}

export function getCurrentDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function formatEnergy(kwh: number): string {
  return `${kwh.toFixed(2)} kWh`;
}

export function formatPower(watts: number): string {
  if (watts >= 1000) {
    return `${(watts / 1000).toFixed(2)} kW`;
  }
  return `${watts.toFixed(0)} W`;
}

export function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

export function getEfficiencyGrade(efficiency: number): 'A' | 'B' | 'C' | 'D' | 'E' {
  if (efficiency >= 90) return 'A';
  if (efficiency >= 75) return 'B';
  if (efficiency >= 60) return 'C';
  if (efficiency >= 45) return 'D';
  return 'E';
}

export function getStatusColor(status: boolean, online: boolean): string {
  if (!online) return '#8B8F99'; // muted
  if (status) return '#84CC16'; // on-state
  return '#6B7280'; // off
}

export function generateInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getRandomAvatarColor(): string {
  const colors = ['#2563EB', '#7C3AED', '#06B6D4', '#D4A017', '#10B981', '#F59E0B'];
  return colors[Math.floor(Math.random() * colors.length)];
}

export function calculateTotalEnergy(devices: any[]): number {
  return devices.reduce((sum, device) => sum + (device.energyToday || 0), 0);
}

export function calculateTotalCost(devices: any[]): number {
  return devices.reduce((sum, device) => sum + (device.costToday || 0), 0);
}

export function calculateActivePower(devices: any[]): number {
  return devices.reduce((sum, device) => sum + (device.on ? device.power || 0 : 0), 0);
}

export function calculateAveragePower(devices: any[]): number {
  if (devices.length === 0) return 0;
  return calculateActivePower(devices) / devices.length;
}

export function getDeviceStatus(online: boolean, on: boolean): string {
  if (!online) return 'Offline';
  if (on) return 'On';
  return 'Off';
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return `${text.slice(0, length)}...`;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
