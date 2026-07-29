'use client';

import { useState } from 'react';
import {
  Sun,
  Moon,
  Tv,
  Book,
  Plus,
  Search,
  Clock,
} from 'lucide-react';
import { SceneCard } from '@/components/scenes/SceneCard';

// Mock scenes data
const MOCK_SCENES = [
  {
    id: '1',
    name: 'Good Morning',
    description: 'Wake up scene with gradually increasing lights and morning news',
    icon: Sun,
    color: 'bg-gradient-to-br from-amber-500 to-orange-500',
    isActive: false,
    lastActivated: '2 hours ago',
    deviceCount: 12,
  },
  {
    id: '2',
    name: 'Movie Time',
    description: 'Dim all lights, close blinds, and set entertainment zone',
    icon: Tv,
    color: 'bg-gradient-to-br from-purple-600 to-indigo-600',
    isActive: true,
    lastActivated: 'now',
    deviceCount: 8,
  },
  {
    id: '3',
    name: 'Reading Mode',
    description: 'Soft warm lighting perfect for reading and relaxation',
    icon: Book,
    color: 'bg-gradient-to-br from-blue-500 to-cyan-400',
    isActive: false,
    lastActivated: 'yesterday',
    deviceCount: 5,
  },
  {
    id: '4',
    name: 'Good Night',
    description: 'Activate security, close blinds, turn off all lights gradually',
    icon: Moon,
    color: 'bg-gradient-to-br from-slate-600 to-blue-900',
    isActive: false,
    lastActivated: 'yesterday',
    deviceCount: 15,
  },
];

export default function ScenesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState(false);

  const filteredScenes = MOCK_SCENES.filter((scene) => {
    const matchesSearch = scene.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (filterActive) {
      return matchesSearch && scene.isActive;
    }
    return matchesSearch;
  });

  const handleSceneActivate = async (sceneId: string) => {
    console.log(`[v0] Activating scene: ${sceneId}`);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Scenes</h1>
        <p className="text-slate-400">Quick routines to automate your home</p>
      </div>

      {/* Scene Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Total Scenes</p>
              <p className="text-2xl font-bold text-slate-100 mt-1">
                {MOCK_SCENES.length}
              </p>
            </div>
            <div className="text-3xl opacity-30">🎬</div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Active Now</p>
              <p className="text-2xl font-bold text-green-400 mt-1">
                {MOCK_SCENES.filter((s) => s.isActive).length}
              </p>
            </div>
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search scenes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-slate-800 transition-all"
          />
        </div>

        <button
          onClick={() => setFilterActive(!filterActive)}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
            filterActive
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800/50 border border-slate-700/50 text-slate-300 hover:border-slate-600'
          }`}
        >
          <Clock className="w-4 h-4" />
          Active Only
        </button>

        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Scene
        </button>
      </div>

      {/* Scenes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredScenes.map((scene) => (
          <SceneCard
            key={scene.id}
            {...scene}
            onActivate={() => handleSceneActivate(scene.id)}
            onEdit={() => console.log(`[v0] Edit scene: ${scene.id}`)}
          />
        ))}
      </div>

      {filteredScenes.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400">
            {filterActive ? 'No active scenes' : 'No scenes found'}
          </p>
        </div>
      )}

      {/* Scene Automation Info */}
      <div className="mt-8 rounded-lg border border-slate-700/50 bg-gradient-to-br from-blue-500/5 to-blue-500/0 p-6 backdrop-blur-sm">
        <h3 className="font-semibold text-slate-100 mb-2">Scene Automation</h3>
        <p className="text-sm text-slate-400">
          Create custom scenes to automate multiple devices at once. Scenes can be triggered
          manually, by schedule, or through automations. Combine scenes to build powerful
          routines for different times of day or activities.
        </p>
      </div>
    </div>
  );
}
