import { HistoryItem } from '../../types/autostory';

const DB_NAME = 'VideoStoryDB';
const DB_VERSION = 1;
const STORE_NAME = 'history';

// A singleton promise that resolves with the database instance.
let dbPromise: Promise<IDBDatabase> | null = null;

const getDbInstance = (): Promise<IDBDatabase> => {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('sessionId', 'sessionId', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                resolve((event.target as IDBOpenDBRequest).result);
            };

            request.onerror = (event) => {
                console.error('IndexedDB error:', (event.target as IDBOpenDBRequest).error);
                // Reset promise on error to allow retrying
                dbPromise = null; 
                reject((event.target as IDBOpenDBRequest).error);
            };
        });
    }
    return dbPromise;
};

// Eagerly initialize the database. The component calls this.
export const initDB = (): Promise<boolean> => {
    return getDbInstance().then(() => true).catch(() => false);
};

export const addHistoryItem = async (item: Omit<HistoryItem, 'id'>): Promise<number> => {
    const db = await getDbInstance();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(item);

        request.onsuccess = () => {
            resolve(request.result as number);
        };
        
        request.onerror = () => {
            console.error('Error adding item:', request.error);
            reject(request.error);
        };
    });
};

export const getHistory = async (): Promise<HistoryItem[]> => {
    const db = await getDbInstance();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const sortedResult = request.result.sort((a, b) => b.timestamp - a.timestamp);
            resolve(sortedResult);
        };

        request.onerror = () => {
            console.error('Error getting history:', request.error);
            reject(request.error);
        };
    });
};

export const deleteHistoryItem = async (id: number): Promise<void> => {
    const db = await getDbInstance();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.delete(id);

        transaction.oncomplete = () => {
            resolve();
        };

        transaction.onerror = () => {
            console.error('Error deleting item:', transaction.error);
            reject(transaction.error);
        };
    });
};

export const deleteHistorySession = async (sessionId: number): Promise<void> => {
    const db = await getDbInstance();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();
        
        request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
                if (cursor.value.sessionId === sessionId) {
                    cursor.delete();
                }
                cursor.continue();
            }
        };

        transaction.oncomplete = () => {
            resolve();
        };

        transaction.onerror = (event) => {
            console.error('Error deleting session items:', transaction.error);
            reject(transaction.error);
        };
    });
};
