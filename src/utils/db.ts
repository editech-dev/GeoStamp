// Database utility for local client-side persistence using IndexedDB
const DB_NAME = 'WatermarkAppDB';
const DB_VERSION = 1;

export interface AppConfig {
  companyName: string;
  logoPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  textPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  watermarkSize: 'small' | 'medium' | 'large';
  showGPS: boolean;
  showDateTime: boolean;
  watermarkStyle: 'plain' | 'card';
  activeLogoId: string | null;
  fontFamily: string;
  fontBold: boolean;
}

export interface LogoRecord {
  id: string;
  name: string;
  blob: Blob;
}

const DEFAULT_CONFIG: AppConfig = {
  companyName: 'UNION ELÉCTRICA',
  logoPosition: 'top-left',
  textPosition: 'bottom-right',
  watermarkSize: 'small',
  showGPS: true,
  showDateTime: true,
  watermarkStyle: 'card',
  activeLogoId: null,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontBold: true,
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
      if (!db.objectStoreNames.contains('logos')) {
        db.createObjectStore('logos', { keyPath: 'id' });
      }
    };
  });
}

export async function getConfig(): Promise<AppConfig> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction('settings', 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get('app_config');

      request.onsuccess = () => {
        if (request.result) {
          resolve({
            ...DEFAULT_CONFIG,
            ...request.result
          });
        } else {
          resolve(DEFAULT_CONFIG);
        }
      };
      request.onerror = () => {
        resolve(DEFAULT_CONFIG);
      };
    });
  } catch (error) {
    console.error('Failed to open IndexedDB for getConfig', error);
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('settings', 'readwrite');
    const store = transaction.objectStore('settings');
    const request = store.put(config, 'app_config');

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllLogos(): Promise<LogoRecord[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('logos', 'readonly');
      const store = transaction.objectStore('logos');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to open IndexedDB for getAllLogos', error);
    return [];
  }
}

export async function saveLogo(logo: LogoRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('logos', 'readwrite');
    const store = transaction.objectStore('logos');
    const request = store.put(logo);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteLogo(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('logos', 'readwrite');
    const store = transaction.objectStore('logos');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
