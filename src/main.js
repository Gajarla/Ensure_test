import {
  INDEXEDDB_NAME,
  CURRENT_USER,
  CURRENT_PROJECT,
  IndexedDB,
  INDEXEDDB_PERMISSIONS,
  PERSIST_STORE
} from './Constants';

const version = 1;

indexedDB.deleteDatabase(INDEXEDDB_NAME);

const request = indexedDB.open(INDEXEDDB_NAME, version);

request.onupgradeneeded = function createObjectStore(e) {
  const db = e.target.result;
  const objects = Object.values(db.objectStoreNames);
  Object.keys(IndexedDB).forEach((object) => {
    if (objects.length === 0 || !objects.include(IndexedDB[object])) {
      db.createObjectStore(IndexedDB[object], { autoIncrement: false });
    }
  });
};

request.onsuccess = async function checkObjectStore(e) {
  const db = e.target.result;
  const objects = Object.values(db.objectStoreNames);

  if (objects.length !== Object.keys(IndexedDB).length) {
    Object.keys(IndexedDB).forEach((object) => {
      if (objects.length === 0 || !objects.include(IndexedDB[object])) {
        db.createObjectStore(IndexedDB[object], { autoIncrement: false });
      }
    });
  }
};

export const setIDBCurrentUser = (loggedinUser) => {
  try {
    const request = indexedDB.open(INDEXEDDB_NAME, version);

    request.onsuccess = function createCurrentUser(event) {
      const db = event.target.result;
      const objects = Object.values(db.objectStoreNames);

      if (objects.length !== Object.keys(IndexedDB).length) {
        Object.keys(IndexedDB).forEach((object) => {
          if (objects.length === 0 || !objects.include(IndexedDB[object])) {
            db.createObjectStore(IndexedDB[object], { autoIncrement: false });
          }
        });
      }
      const transaction = db.transaction([IndexedDB.USER], INDEXEDDB_PERMISSIONS.READ_WRITE);
      const objectStore = transaction.objectStore(IndexedDB.USER);
      objectStore.put(loggedinUser, CURRENT_USER);
    };
  } catch (err) {
    console.log('err', err);
  }
};

export const getIDBCurrentUser = () =>
  new Promise((resolve, reject) => {
    try {
      const persistUser = JSON.parse(window.localStorage.getItem(PERSIST_STORE.USER));
      setIDBCurrentUser(persistUser);
      const request = indexedDB.open(INDEXEDDB_NAME, version);
      request.onsuccess = function success(event) {
        const db = event.target.result;
        const transaction = db.transaction([IndexedDB.USER], INDEXEDDB_PERMISSIONS.READ_ONLY);
        const objectStore = transaction.objectStore(IndexedDB.USER);
        const request = objectStore.get(CURRENT_USER);
        request.onsuccess = function success(event) {
          resolve(event?.target?.result);
        };
        request.onerror = function error(event) {
          reject(event.target.error);
        };
      };
    } catch (err) {
      console.log('err', err);
    }
  });

export const setIDBCurrenrProject = (currentProject) => {
  try {
    const request = indexedDB.open(INDEXEDDB_NAME, version);
    request.onsuccess = function success(event) {
      const db = event.target.result;
      const transaction = db.transaction([IndexedDB.PROJECT], INDEXEDDB_PERMISSIONS.READ_WRITE);
      const objectStore = transaction.objectStore(IndexedDB.PROJECT);
      if (currentProject) {
        objectStore.put(currentProject, CURRENT_PROJECT);
      } else {
        objectStore.delete(CURRENT_PROJECT);
      }
    };
  } catch (err) {
    console.log('err', err);
  }
};

export const getIDBCurrentProject = () =>
  new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(INDEXEDDB_NAME, version);
      const persistProject = JSON.parse(window.localStorage.getItem(PERSIST_STORE.PROJECT));
      setIDBCurrenrProject(persistProject);
      request.onsuccess = function success(event) {
        const db = event.target.result;
        const transaction = db.transaction([IndexedDB.PROJECT], INDEXEDDB_PERMISSIONS.READ_ONLY);
        const objectStore = transaction.objectStore(IndexedDB.PROJECT);
        const request = objectStore.get(CURRENT_PROJECT);
        request.onsuccess = function success(event) {
          resolve(event?.target?.result);
        };
        request.onerror = function error(event) {
          reject(event.target.error);
        };
      };
    } catch (err) {
      console.log('err', err);
    }
  });

export const setIndexedDBObject = (objStore, key, object) => {
  try {
    const request = indexedDB.open(INDEXEDDB_NAME, version);
    request.onsuccess = function success(event) {
      const db = event.target.result;
      const transaction = db.transaction([objStore], INDEXEDDB_PERMISSIONS.READ_WRITE);
      const objectStore = transaction.objectStore(objStore);
      switch (key) {
        case key === CURRENT_USER:
          if (object) {
            objectStore.put(object, CURRENT_USER);
          } else {
            objectStore.delete(CURRENT_USER);
          }
          break;
        case key === CURRENT_PROJECT:
          if (object) {
            objectStore.put(object, CURRENT_PROJECT);
          } else {
            objectStore.delete(CURRENT_PROJECT);
          }
          break;
        default:
          if (object) {
            objectStore.put(object, key);
          } else {
            objectStore.delete(key);
          }
          break;
      }
    };
  } catch (err) {
    console.log('err', err);
  }
};

export const getIndexedDBObject = (objStore, key) =>
  new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(INDEXEDDB_NAME, version);
      request.onsuccess = function success(event) {
        const db = event.target.result;
        const transaction = db.transaction([objStore], INDEXEDDB_PERMISSIONS.READ_ONLY);
        const objectStore = transaction.objectStore(objStore);
        let request = null;
        switch (key) {
          case key === CURRENT_USER:
            request = objectStore.get(CURRENT_USER);
            break;
          case key === CURRENT_PROJECT:
            request = objectStore.get(CURRENT_PROJECT);
            break;
          default:
            request = objectStore.get(key);
            break;
        }
        request.onsuccess = function success(event) {
          resolve(event?.target?.result);
        };
        request.onerror = function error(event) {
          reject(event.target.error);
        };
      };
    } catch (err) {
      console.log('err', err);
    }
  });

export default { setIDBCurrentUser };
