import {nextNumber, checkAbort} from './core.mjs';

async function database() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('captcha-extraction', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('settings');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function setting(key, value) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('settings', value ? 'readwrite' : 'readonly');
      const req = value ? tx.objectStore('settings').put(value, key) : tx.objectStore('settings').get(key);
      tx.oncomplete = () => resolve(value || req.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export const storedDestinations = value => setting('destinations-v1', value);

export async function describeDestination(handle) {
  const root = await setting('root');
  if (root) {
    try {
      const relative = await root.resolve(handle);
      if (relative) return [root.name,...relative].join('\\');
    } catch(e) {
      if (!['NotAllowedError','SecurityError','NotFoundError'].includes(e.name)) throw e;
    }
  }
  return handle.name;
}

export async function loadDestinations() {
  const saved = await storedDestinations();
  if (saved) return saved;
  // Preserve existing output directories on upgrade, without treating the old
  // project root as a new direct destination or creating any folders on load.
  const root = await setting('root'), destinations = {};
  if (root) for (const format of ['A','B']) {
    try {
      const child = await root.getDirectoryHandle(`Format_${format}`);
      destinations[format] = {handle:await child.getDirectoryHandle('raw_data'),visiblePath:[root.name,`Format_${format}`,'raw_data'].join('\\')};
    } catch(e) {
      if (!['NotFoundError','NotAllowedError','SecurityError'].includes(e.name)) throw e;
    }
  }
  await storedDestinations(destinations);
  return destinations;
}
export async function createSequentialSaver(dir, signal) {
  checkAbort(signal);
  let number = 1;
  // Directory iteration has no guaranteed order. Scan names once per run and
  // retain only the maximum, rather than building/sorting a list for every PNG.
  for await (const name of dir.keys()) {
    checkAbort(signal);
    number = Math.max(number, nextNumber([name]));
  }
  return async (blob, saveSignal = signal) => {
    const name = await saveNext(dir, blob, saveSignal, number);
    number = nextNumber([name]);
    return name;
  };
}

async function saveNext(dir, blob, signal, number) {
  checkAbort(signal);
  let name;
  // Recheck before creating; the run also holds an origin-wide exclusive lock.
  while (true) {
    checkAbort(signal);
    if (!Number.isSafeInteger(number)) throw new Error('Filename counter exceeds the safe integer range.');
    name = `input${number}.png`;
    try { await dir.getFileHandle(name); number++; }
    catch (e) { if (e.name === 'NotFoundError') break; throw e; }
  }
  checkAbort(signal);
  const handle = await dir.getFileHandle(name, {create:true});
  let writer;
  try {
    writer = await handle.createWritable();
    await writer.write(blob);
    checkAbort(signal);
    await writer.close();
  } catch (error) {
    await writer?.abort().catch(() => {});
    await dir.removeEntry(name).catch(() => {});
    throw error;
  }
  return name;
}
