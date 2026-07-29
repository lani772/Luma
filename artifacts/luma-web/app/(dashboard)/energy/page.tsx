'use client';

import { useState, useMemo } from 'react';
import { EnergyChart } from '@/components/energy/EnergyChart';
import { StatCard } from '@/components/dashboard/StatCard';
import { COLORS, GRADIENTS } from '@/lib/colors';
import { Zap, TrendingDown, Calendar, Lightbulb } from 'lucide-react';
import { formatEnergy, formatCost } from '@/lib/utils';

type Period = 'today' | 'week' | 'month';

// Mock data
const energyData = {
  today: [
    { label: '00:00', value: 0.2 },
    { label: '04:00', value: 0.1 },
    { label: '08:00', value: 1.5 },
    { label: '12:00', value: 2.3 },
    { label: '16:00', value: 1.8 },
    { label: '20:00', value: 3.2 },
    { label: '23:59', value: 0.8 },
  ],
  week: [
    { label: 'Mon', value: 18.5 },
    { label: 'Tue', value: 19.2 },
    { label: 'Wed', value: 17.8 },
    { label: 'Thu', value: 21.3 },
    { label: 'Fri', value: 22.1 },
    { label: 'Sat', value: 25.4 },
    { label: 'Sun', value: 20.6 },
  ],
  month: [
    { label: 'Week 1', value: 135.0 },
    { label: 'Week 2', value: 142.5 },
    { label: 'Week 3', value: 138.8 },
    { label: 'Week 4', value: 151.2 },
  ],
};

const deviceEnergy = [
  { device: 'Living Room Lamp', kwh: 8.5, cost: 2.55, percentage: 35 },
  { device: 'Bedroom Lamp', kwh: 6.2, cost: 1.86, percentage: 26 },
  { device: 'Kitchen Light', kwh: 4.8, cost: 1.44, percentage: 20 },
  { device: 'Office Desk Lamp', kwh: 3.9, cost: 1.17, percentage: 16 },
  { device: 'Hallway Light', kwh: 1.6, cost: 0.48, percentage: 7 },
];

const roomDistribution = [
  { room: 'Living Room', kwh: 10.2, percentage: 42 },
  { room: 'Bedroom', kwh: 7.5, percentage: 31 },
  { room: 'Kitchen', kwh: 4.1, percentage: 17 },
  { room: 'Office', kwh: 2.2, percentage: 9 },
];

export default function EnergyPage() {
  const [period, setPeriod] = useState<Period>('today');
  const [activeTab, setActiveTab] = useState<'overview' | 'devices' | 'rooms'>('overview');

  const chartData = useMemo(() => {
    return energyData[period];
  }, [period]);

  const totalEnergy = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.value, 0);
  }, [chartData]);

  const totalCost = useMemo(() => {
    return (totalEnergy * 3.0).toFixed(2);
  }, [totalEnergy]);

  const avgDaily = useMemo(() => {
    if (period === 'today') return totalEnergy;
    if (period === 'week') return (totalEnergy / 7).toFixed(2);
    return (totalEnergy / 30).toFixed(2);
  }, [totalEnergy, period]);

  const peakUsage = useMemo(() => {
    return Math.max(...chartData.map((d) => d.value)).toFixed(2);
  }, [chartData]);

  return (
    <div className="flex-1 p-6 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">Energy Dashboard</h1>

        {/* Period Selector */}
        <div className="flex gap-2">
          {(['today', 'week', 'month'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                period === p
                  ? 'bg-primary-blue text-white'
                  : 'bg-card-hover text-muted hover:text-foreground'
              }`}
            >
              {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Energy"
          value={formatEnergy(totalEnergy)}
          icon={Zap}
          color={COLORS.accentTeal}
          trend={{ value: 5, isPositive: true }}
        />
        <StatCard
          label="Estimated Cost"
          value={`$${totalCost}`}
          icon={Zap}
          color={COLORS.warning}
          trend={{ value: 8, isPositive: false }}
        />
        <StatCard
          label={period === 'today' ? 'Current Usage' : 'Avg Daily'}
          value={formatEnergy(Number(avgDaily))}
          icon={TrendingDown}
          color={COLORS.onState}
        />
        <StatCard
          label="Peak Usage"
          value={formatEnergy(Number(peakUsage))}
          icon={Calendar}
          color={COLORS.gold}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border">
        {(['overview', 'devices', 'rooms'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === tab
                ? 'border-primary-blue text-primary-blue'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            {tab === 'overview' ? 'Overview' : tab === 'devices' ? 'By Device' : 'By Room'}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Energy Chart */}
          <div className="glass rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">
              Consumption Trend {period === 'today' ? '(Hourly)' : period === 'week' ? '(Daily)' : '(Weekly)'}
            </h2>
            <EnergyChart data={chartData} type={period === 'today' ? 'line' : 'bar'} height={300} />
          </div>
        </div>
      )}

      {activeTab === 'devices' && (
        <div className="space-y-6">
          {/* Device Breakdown */}
          <div className="glass rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Energy by Device</h2>
            <div className="space-y-3">
              {deviceEnergy.map((device) => (
                <div key={device.device} className="border-b border-border pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Lightbulb size={18} style={{ color: COLORS.onState }} />
                      <span className="font-medium">{device.device}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatEnergy(device.kwh)}</div>
                      <div className="text-xs text-muted">{formatCost(device.cost)}</div>
                    </div>
                  </div>
                  <div className="h-2 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-accentTeal to-accent-teal-light"
                      style={{
                        width: `${device.percentage}%`,
                        background: `linear-gradient(90deg, ${COLORS.accentTeal}, ${COLORS.accentTealLight})`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-muted">{device.percentage}% of total</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'rooms' && (
        <div className="space-y-6">
          {/* Room Distribution */}
          <div className="glass rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Energy by Room</h2>
            <div className="space-y-3">
              {roomDistribution.map((room) => (
                <div key={room.room} className="border-b border-border pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{room.room}</span>
                    <div className="text-right">
                      <div className="font-semibold">{formatEnergy(room.kwh)}</div>
                      <div className="text-xs text-muted">{room.percentage}% of total</div>
                    </div>
                  </div>
                  <div className="h-3 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r"
                      style={{
                        width: `${room.percentage}%`,
                        background: `linear-gradient(90deg, ${COLORS.accentTeal}, ${COLORS.accentTealLight})`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
