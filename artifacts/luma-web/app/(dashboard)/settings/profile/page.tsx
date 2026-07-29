'use client';

import { useState } from 'react';
import { User, Mail, Phone, MapPin, Save, AlertCircle, CheckCircle } from 'lucide-react';

export default function ProfileSettingsPage() {
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [formData, setFormData] = useState({
    fullName: 'John Doe',
    email: 'john@example.com',
    phone: '+1 (555) 123-4567',
    location: 'San Francisco, CA',
    bio: 'Smart home enthusiast and tech lover',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSaveStatus('success');
      setIsEditing(false);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Profile Settings</h1>
        <p className="text-slate-400">Manage your personal information</p>
      </div>

      {/* Profile Picture Section */}
      <div className="mb-8 rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-6 backdrop-blur-sm">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-3xl font-bold text-white">
            JD
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-100 mb-2">Profile Picture</h3>
            <p className="text-sm text-slate-400 mb-4">JPG, PNG or GIF. Max 5MB.</p>
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
              Upload Photo
            </button>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {saveStatus === 'success' && (
        <div className="mb-6 rounded-lg border border-green-500/20 bg-green-500/10 p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <span className="text-sm text-green-300">Profile updated successfully</span>
        </div>
      )}

      {saveStatus === 'error' && (
        <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="text-sm text-red-300">Failed to update profile. Please try again.</span>
        </div>
      )}

      {/* Profile Form */}
      <div className="mb-8 rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-6 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-400" />
            Personal Information
          </h2>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg font-medium transition-colors"
          >
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
        </div>

        <div className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Full Name</label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              disabled={!isEditing}
              className={`w-full px-4 py-2 rounded-lg border border-slate-700/50 bg-slate-800/30 text-slate-100 ${
                isEditing ? 'focus:border-blue-500/50 focus:bg-slate-800' : 'opacity-70 cursor-not-allowed'
              } transition-all disabled:cursor-not-allowed`}
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              disabled={!isEditing}
              className={`w-full px-4 py-2 rounded-lg border border-slate-700/50 bg-slate-800/30 text-slate-100 ${
                isEditing ? 'focus:border-blue-500/50 focus:bg-slate-800' : 'opacity-70 cursor-not-allowed'
              } transition-all disabled:cursor-not-allowed`}
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Phone Number
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              disabled={!isEditing}
              className={`w-full px-4 py-2 rounded-lg border border-slate-700/50 bg-slate-800/30 text-slate-100 ${
                isEditing ? 'focus:border-blue-500/50 focus:bg-slate-800' : 'opacity-70 cursor-not-allowed'
              } transition-all disabled:cursor-not-allowed`}
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Location
            </label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              disabled={!isEditing}
              className={`w-full px-4 py-2 rounded-lg border border-slate-700/50 bg-slate-800/30 text-slate-100 ${
                isEditing ? 'focus:border-blue-500/50 focus:bg-slate-800' : 'opacity-70 cursor-not-allowed'
              } transition-all disabled:cursor-not-allowed`}
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Bio</label>
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              disabled={!isEditing}
              rows={4}
              className={`w-full px-4 py-2 rounded-lg border border-slate-700/50 bg-slate-800/30 text-slate-100 resize-none ${
                isEditing ? 'focus:border-blue-500/50 focus:bg-slate-800' : 'opacity-70 cursor-not-allowed'
              } transition-all disabled:cursor-not-allowed`}
            />
          </div>
        </div>

        {isEditing && (
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-wait text-white rounded-lg font-medium transition-colors"
            >
              <Save className="w-4 h-4" />
              {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Account Information */}
      <div className="rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-6 backdrop-blur-sm">
        <h2 className="text-xl font-semibold text-slate-100 mb-4">Account Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-slate-400 mb-1">Account Created</p>
            <p className="text-slate-100 font-medium">January 15, 2024</p>
          </div>
          <div>
            <p className="text-sm text-slate-400 mb-1">Last Updated</p>
            <p className="text-slate-100 font-medium">Today at 2:30 PM</p>
          </div>
          <div>
            <p className="text-sm text-slate-400 mb-1">Account Status</p>
            <p className="text-green-400 font-medium">Active</p>
          </div>
          <div>
            <p className="text-sm text-slate-400 mb-1">Devices Connected</p>
            <p className="text-slate-100 font-medium">24</p>
          </div>
        </div>
      </div>
    </div>
  );
}
