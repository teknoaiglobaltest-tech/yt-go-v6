import { ApiKey, Avatar, Product, Project, FashionHistoryItem, Location, Character, VideoHistoryItem, TTSHistoryItem } from '../types';

const DB_NAME = 'SuperAffiliateDB';
// FIX: Incremented DB version to handle schema change for TTS history.
const DB_VERSION = 12; 

let db: IDBDatabase;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Database error:', request.error);
      reject('Error opening database');
    };

    request.onsuccess = (event) => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains('avatars')) {
        dbInstance.createObjectStore('avatars', { keyPath: 'id', autoIncrement: true });
      }
      if (!dbInstance.objectStoreNames.contains('products')) {
        dbInstance.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
      }
      if (!dbInstance.objectStoreNames.contains('projects')) {
        dbInstance.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
      }
      if (!dbInstance.objectStoreNames.contains('fashionHistory')) {
        dbInstance.createObjectStore('fashionHistory', { keyPath: 'id', autoIncrement: true });
      }
      if (!dbInstance.objectStoreNames.contains('locations')) {
        dbInstance.createObjectStore('locations', { keyPath: 'id', autoIncrement: true });
      }
      if (!dbInstance.objectStoreNames.contains('settings')) {
        dbInstance.createObjectStore('settings', { keyPath: 'key' });
      }
      if (!dbInstance.objectStoreNames.contains('apiKeys')) {
        dbInstance.createObjectStore('apiKeys', { keyPath: 'id', autoIncrement: true });
      }
      // Add 'characters' object store for managing generated characters.
      if (!dbInstance.objectStoreNames.contains('characters')) {
        const characterStore = dbInstance.createObjectStore('characters', { keyPath: 'id', autoIncrement: true });
        characterStore.createIndex('projectId', 'projectId', { unique: false });
      }
      if (!dbInstance.objectStoreNames.contains('videoHistory')) {
        dbInstance.createObjectStore('videoHistory', { keyPath: 'id', autoIncrement: true });
      }
      // FIX: Re-add the 'ttsHistory' object store for TTS functionality.
      if (!dbInstance.objectStoreNames.contains('ttsHistory')) {
        dbInstance.createObjectStore('ttsHistory', { keyPath: 'id', autoIncrement: true });
      }
      
      if (event.oldVersion < 10) {
        const transaction = (event.target as IDBOpenDBRequest).transaction;
        if(transaction) {
            if (dbInstance.objectStoreNames.contains('videoHistory')) {
                const videoStore = transaction.objectStore('videoHistory');
                if (!videoStore.indexNames.contains('projectId')) {
                    videoStore.createIndex('projectId', 'projectId', { unique: false });
                }
            }
        }
      }
    };
  });
};

export const saveData = <T,>(storeName: string, data: T): Promise<number> => {
  return new Promise(async (resolve, reject) => {
    const db = await initDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(data);

    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
};

export const getAllData = <T,>(storeName: string): Promise<T[]> => {
    return new Promise(async (resolve, reject) => {
        const db = await initDB();
        if (!db.objectStoreNames.contains(storeName)) {
            return resolve([]);
        }
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const updateData = <T extends { id?: number }>(storeName: string, data: T): Promise<number> => {
    return new Promise(async (resolve, reject) => {
        if (!data.id) return reject("Data must have an id to be updated");
        const db = await initDB();
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);

        request.onsuccess = () => resolve(request.result as number);
        request.onerror = () => reject(request.error);
    });
};

export const putData = <T,>(storeName: string, data: T): Promise<IDBValidKey> => {
    return new Promise(async (resolve, reject) => {
        const db = await initDB();
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const getByKey = <T,>(storeName: string, key: IDBValidKey): Promise<T | undefined> => {
    return new Promise(async (resolve, reject) => {
        const db = await initDB();
        if (!db.objectStoreNames.contains(storeName)) {
            return resolve(undefined);
        }
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const deleteData = (storeName: string, id: number): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    const db = await initDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const dbService = {
  addAvatar: (avatar: Avatar) => saveData<Avatar>('avatars', avatar),
  getAvatars: () => getAllData<Avatar>('avatars'),
  updateAvatar: (avatar: Avatar) => updateData<Avatar>('avatars', avatar),
  deleteAvatar: (id: number) => deleteData('avatars', id),
  
  addProduct: (product: Product) => saveData<Product>('products', product),
  getProducts: () => getAllData<Product>('products'),
  updateProduct: (product: Product) => updateData<Product>('products', product),
  deleteProduct: (id: number) => deleteData('products', id),

  addProject: (project: Project) => saveData<Project>('projects', project),
  updateProject: (project: Project) => updateData<Project>('projects', project),
  getProjects: () => getAllData<Project>('projects'),
  deleteProject: (id: number) => deleteData('projects', id),

  addFashionHistoryItem: (item: FashionHistoryItem) => saveData<FashionHistoryItem>('fashionHistory', item),
  getFashionHistoryItems: () => getAllData<FashionHistoryItem>('fashionHistory'),
  updateFashionHistoryItem: (item: FashionHistoryItem) => updateData<FashionHistoryItem>('fashionHistory', item),
  deleteFashionHistoryItem: (id: number) => deleteData('fashionHistory', id),

  addLocation: (location: Location) => saveData<Location>('locations', location),
  getLocations: () => getAllData<Location>('locations'),
  updateLocation: (location: Location) => updateData<Location>('locations', location),
  deleteLocation: (id: number) => deleteData('locations', id),

  addVideoHistoryItem: (item: Omit<VideoHistoryItem, 'id'>) => saveData<Omit<VideoHistoryItem, 'id'>>('videoHistory', item),
  getVideoHistoryItems: () => getAllData<VideoHistoryItem>('videoHistory'),
  deleteVideoHistoryItem: (id: number) => deleteData('videoHistory', id),

  // FIX: Add db service method for TTS history.
  addTTSHistoryItem: (item: Omit<TTSHistoryItem, 'id'>) => saveData<Omit<TTSHistoryItem, 'id'>>('ttsHistory', item),

  addSetting: (setting: { key: string, value: any }) => putData('settings', setting),
  getSetting: (key: string) => getByKey<{ key: string, value: any }>('settings', key),

  addApiKey: (apiKey: Omit<ApiKey, 'id'>) => saveData<Omit<ApiKey, 'id'>>('apiKeys', apiKey),
  getApiKeys: () => getAllData<ApiKey>('apiKeys'),
  getApiKey: (id: number) => getByKey<ApiKey>('apiKeys', id),
  updateApiKey: (apiKey: ApiKey) => updateData<ApiKey>('apiKeys', apiKey),
  deleteApiKey: (id: number) => deleteData('apiKeys', id),

  addCharacter: (character: Omit<Character, 'id'>) => saveData<Omit<Character, 'id'>>('characters', character),
  getCharactersByProjectId: (projectId: number): Promise<Character[]> => {
    return new Promise(async (resolve, reject) => {
        const db = await initDB();
        const transaction = db.transaction('characters', 'readonly');
        const store = transaction.objectStore('characters');
        const index = store.index('projectId');
        const request = index.getAll(projectId);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
  },
  getVideosByProjectId: (projectId: number): Promise<VideoHistoryItem[]> => {
    return new Promise(async (resolve, reject) => {
        const db = await initDB();
        const transaction = db.transaction('videoHistory', 'readonly');
        const store = transaction.objectStore('videoHistory');
        const index = store.index('projectId');
        const request = index.getAll(projectId);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
  },
};