import axios, { AxiosInstance } from 'axios';
import { AuthResponse, User, Lamp, Scene, LumaNotification, ActivityLog } from '@/lib/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090/cloud';

class APIClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Load token from storage on initialization
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (token) {
        this.setToken(token);
      }
    }

    // Add request interceptor
    this.client.interceptors.request.use((config) => {
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });

    // Add response interceptor for token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Try to refresh token
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            try {
              const response = await this.client.post<AuthResponse>('/auth/refresh', {
                refreshToken,
              });
              this.setToken(response.data.accessToken);
              // Retry original request
              return this.client(error.config);
            } catch {
              // Refresh failed, redirect to login
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              window.location.href = '/login';
            }
          }
        }
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string) {
    this.accessToken = token;
    localStorage.setItem('accessToken', token);
  }

  clearToken() {
    this.accessToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  // ─── Authentication ─────────────────────────────────────────────────────
  async register(email: string, password: string, fullName: string) {
    const response = await this.client.post<AuthResponse>('/auth/register', {
      email,
      password,
      fullName,
      username: email.split('@')[0],
    });
    this.setToken(response.data.accessToken);
    return response.data;
  }

  async login(email: string, password: string) {
    const response = await this.client.post<AuthResponse>('/auth/login', {
      email,
      password,
    });
    this.setToken(response.data.accessToken);
    localStorage.setItem('refreshToken', response.data.refreshToken);
    return response.data;
  }

  async logout() {
    try {
      await this.client.post('/auth/logout');
    } finally {
      this.clearToken();
    }
  }

  async getProfile() {
    const response = await this.client.get<User>('/users/me');
    return response.data;
  }

  async requestPasswordReset(email: string) {
    await this.client.post('/auth/password-reset/request', { email });
  }

  // ─── Devices ────────────────────────────────────────────────────────────
  async getDevices() {
    const response = await this.client.get<Lamp[]>('/devices');
    return response.data;
  }

  async getDevice(id: string) {
    const response = await this.client.get<Lamp>(`/devices/${id}`);
    return response.data;
  }

  async updateDevice(id: string, data: Partial<Lamp>) {
    const response = await this.client.patch<Lamp>(`/devices/${id}`, data);
    return response.data;
  }

  async createDevice(data: Omit<Lamp, 'id'>) {
    const response = await this.client.post<Lamp>('/devices', data);
    return response.data;
  }

  async deleteDevice(id: string) {
    await this.client.delete(`/devices/${id}`);
  }

  // ─── Device Control ─────────────────────────────────────────────────────
  async toggleDevice(id: string, on: boolean) {
    return this.updateDevice(id, { on });
  }

  async setBrightness(id: string, brightness: number) {
    return this.updateDevice(id, { brightness });
  }

  async setColorTemp(id: string, colorTemp: number) {
    return this.updateDevice(id, { colorTemp });
  }

  async setRGB(id: string, rgb: string) {
    return this.updateDevice(id, { rgb });
  }

  // ─── Scenes ─────────────────────────────────────────────────────────────
  async getScenes() {
    // For now, return static scenes. In production, fetch from API
    const scenes: Scene[] = [
      {
        id: 'morning',
        name: 'Morning',
        emoji: '🌅',
        color: '#D4A017',
        active: false,
        description: 'Wake up and energize',
        devices: [],
      },
      {
        id: 'movie',
        name: 'Movie',
        emoji: '🎬',
        color: '#7C3AED',
        active: false,
        description: 'Relax and watch',
        devices: [],
      },
      {
        id: 'reading',
        name: 'Reading',
        emoji: '📖',
        color: '#06B6D4',
        active: false,
        description: 'Focus and read',
        devices: [],
      },
      {
        id: 'sleep',
        name: 'Sleep',
        emoji: '🌙',
        color: '#4F46E5',
        active: false,
        description: 'Rest and recover',
        devices: [],
      },
    ];
    return scenes;
  }

  async activateScene(sceneId: string) {
    // In production, call the real API
    console.log('Activating scene:', sceneId);
  }

  // ─── Notifications ──────────────────────────────────────────────────────
  async getNotifications() {
    const response = await this.client.get<LumaNotification[]>('/notifications');
    return response.data;
  }

  async markNotificationRead(id: string) {
    await this.client.post(`/notifications/${id}/mark-read`);
  }

  // ─── Activity Log ────────────────────────────────────────────────────────
  async getActivityLog() {
    const response = await this.client.get<ActivityLog[]>('/admin/audit');
    return response.data;
  }

  // ─── Energy Data ─────────────────────────────────────────────────────────
  async getEnergyData(deviceId: string, period: 'today' | 'week' | 'month') {
    const response = await this.client.get(`/devices/${deviceId}/energy?period=${period}`);
    return response.data;
  }

  // ─── Users (Admin) ──────────────────────────────────────────────────────
  async getUsers() {
    const response = await this.client.get<User[]>('/admin/users');
    return response.data;
  }

  async updateUserRole(userId: string, role: string) {
    const response = await this.client.patch<User>(`/admin/users/${userId}/role`, {
      role,
    });
    return response.data;
  }

  // ─── Firmware ───────────────────────────────────────────────────────────
  async getFirmware() {
    const response = await this.client.get('/firmware');
    return response.data;
  }

  // ─── Error Handling ─────────────────────────────────────────────────────
  getErrorMessage(error: any): string {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error.message === 'Network Error') {
      return 'Network error. Please check your connection.';
    }
    return error.message || 'An error occurred';
  }
}

export const apiClient = new APIClient();
