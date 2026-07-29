import { Device, Scene, Room } from '@/lib/types';

interface OfflineData {
  devices: Device[];
  scenes: Scene[];
  rooms: Room[];
  timestamp: number;
  version: number;
}

interface PendingAction {
  id: string;
  action: string;
  data: any;
  timestamp: number;
  retries: number;
}

const STORAGE_KEY = 'luma_offline_data';
const PENDING_KEY = 'luma_pending_actions';
const DB_VERSION = 1;

/**
 * OfflineService handles offline data storage and synchronization
 */
export class OfflineService {
  private static db: IDBDatabase | null = null;

  /**
   * Initialize IndexedDB
   */
  static async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('LumaOfflineDB', DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('devices')) {
          db.createObjectStore('devices', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('scenes')) {
          db.createObjectStore('scenes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('rooms')) {
          db.createObjectStore('rooms', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('pendingActions')) {
          db.createObjectStore('pendingActions', { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Save devices for offline use
   */
  static async saveDevices(devices: Device[]): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['devices'], 'readwrite');
      const store = tx.objectStore('devices');

      // Clear existing devices
      store.clear();

      // Save new devices
      devices.forEach(device => {
        store.add(device);
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Get offline devices
   */
  static async getOfflineDevices(): Promise<Device[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['devices'], 'readonly');
      const store = tx.objectStore('devices');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save scenes for offline use
   */
  static async saveScenes(scenes: Scene[]): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['scenes'], 'readwrite');
      const store = tx.objectStore('scenes');

      store.clear();
      scenes.forEach(scene => {
        store.add(scene);
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Get offline scenes
   */
  static async getOfflineScenes(): Promise<Scene[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['scenes'], 'readonly');
      const store = tx.objectStore('scenes');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Queue an action for offline execution
   */
  static async queueAction(action: string, data: any): Promise<string> {
    if (!this.db) await this.init();

    const pendingAction: PendingAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      action,
      data,
      timestamp: Date.now(),
      retries: 0,
    };

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['pendingActions'], 'readwrite');
      const store = tx.objectStore('pendingActions');
      const request = store.add(pendingAction);

      request.onsuccess = () => resolve(pendingAction.id);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get pending actions
   */
  static async getPendingActions(): Promise<PendingAction[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['pendingActions'], 'readonly');
      const store = tx.objectStore('pendingActions');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Remove a pending action after successful sync
   */
  static async removePendingAction(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['pendingActions'], 'readwrite');
      const store = tx.objectStore('pendingActions');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update retry count for pending action
   */
  static async updatePendingActionRetry(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['pendingActions'], 'readwrite');
      const store = tx.objectStore('pendingActions');
      const request = store.get(id);

      request.onsuccess = () => {
        const action = request.result;
        if (action) {
          action.retries++;
          store.put(action);
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save offline data to localStorage as backup
   */
  static saveOfflineDataCache(data: OfflineData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[Offline] Failed to save cache:', error);
    }
  }

  /**
   * Get offline data from localStorage
   */
  static getOfflineDataCache(): OfflineData | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[Offline] Failed to get cache:', error);
      return null;
    }
  }

  /**
   * Clear all offline data
   */
  static async clearOfflineData(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['devices', 'scenes', 'rooms', 'pendingActions'], 'readwrite');
      
      tx.objectStore('devices').clear();
      tx.objectStore('scenes').clear();
      tx.objectStore('rooms').clear();
      tx.objectStore('pendingActions').clear();

      tx.oncomplete = () => {
        localStorage.removeItem(STORAGE_KEY);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Check if offline data is stale
   */
  static isDataStale(lastSync: number, maxAge: number = 24 * 60 * 60 * 1000): boolean {
    return Date.now() - lastSync > maxAge;
  }
}

/**
 * Service Worker registration and management
 */
export class ServiceWorkerManager {
  private static registration: ServiceWorkerRegistration | null = null;

  static async register(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Workers not supported');
      return;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      console.log('[SW] Service Worker registered');
    } catch (error) {
      console.error('[SW] Failed to register:', error);
    }
  }

  static async unregister(): Promise<void> {
    if (this.registration) {
      await this.registration.unregister();
      console.log('[SW] Service Worker unregistered');
    }
  }

  static async update(): Promise<void> {
    if (this.registration) {
      await this.registration.update();
      console.log('[SW] Service Worker updated');
    }
  }
}

/**
 * Background Sync Manager
 */
export class BackgroundSyncManager {
  static async registerSync(tag: string): Promise<void> {
    if (!('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      if ('sync' in registration) {
        await (registration as any).sync.register(tag);
        console.log('[Sync] Background sync registered:', tag);
      }
    } catch (error) {
      console.error('[Sync] Failed to register background sync:', error);
    }
  }
}

/**
 * Battery and Network optimization
 */
export class DeviceOptimization {
  /**
   * Get current battery level
   */
  static async getBatteryLevel(): Promise<number> {
    try {
      const battery = await (navigator as any).getBattery();
      return battery.level * 100;
    } catch {
      return 100;
    }
  }

  /**
   * Check if device is charging
   */
  static async isCharging(): Promise<boolean> {
    try {
      const battery = await (navigator as any).getBattery();
      return battery.charging;
    } catch {
      return false;
    }
  }

  /**
   * Get network connection info
   */
  static getConnectionInfo(): {
    effectiveType: string;
    downlink: number;
    rtt: number;
    saveData: boolean;
  } | null {
    if (!('connection' in navigator)) return null;

    const connection = (navigator as any).connection;
    return {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData,
    };
  }

  /**
   * Determine if should use low-bandwidth mode
   */
  static shouldUseLowBandwidth(): boolean {
    const connection = this.getConnectionInfo();
    if (!connection) return false;

    return connection.saveData || connection.effectiveType === '4g' || connection.effectiveType === '3g';
  }

  /**
   * Optimize image based on connection
   */
  static getOptimizedImageSize(): 'small' | 'medium' | 'large' {
    if (this.shouldUseLowBandwidth()) {
      return 'small';
    }

    const connection = this.getConnectionInfo();
    if (connection?.effectiveType === '4g') {
      return 'large';
    }

    return 'medium';
  }
}
