/**
 * LocalStorage utilities with quota management
 */

// Estimated quota limits (browsers vary)
const QUOTA_WARN_THRESHOLD = 4 * 1024 * 1024; // 4MB warning
const QUOTA_MAX_ESTIMATE = 5 * 1024 * 1024; // 5MB max estimate

/**
 * Calculate approximate size of localStorage in bytes
 */
export function getLocalStorageSize(): number {
  let total = 0;
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += (localStorage[key].length + key.length) * 2; // UTF-16 uses 2 bytes per char
    }
  }
  return total;
}

/**
 * Check if localStorage has enough space for new data
 */
export function hasStorageSpace(requiredBytes: number): boolean {
  const currentSize = getLocalStorageSize();
  return currentSize + requiredBytes < QUOTA_WARN_THRESHOLD;
}

/**
 * Get storage usage statistics
 */
export function getStorageStats() {
  const used = getLocalStorageSize();
  const usedMB = (used / (1024 * 1024)).toFixed(2);
  const percentUsed = ((used / QUOTA_MAX_ESTIMATE) * 100).toFixed(1);

  return {
    used,
    usedMB,
    percentUsed: parseFloat(percentUsed),
    isNearLimit: used > QUOTA_WARN_THRESHOLD,
  };
}

/**
 * Safely set item in localStorage with quota checking
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    const estimatedSize = (value.length + key.length) * 2;

    if (!hasStorageSpace(estimatedSize)) {
      console.warn('LocalStorage quota warning: Near limit, consider clearing old data');
      // Try to set anyway - browser will throw if truly full
    }

    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.error('LocalStorage quota exceeded');
      return false;
    }
    throw e;
  }
}

/**
 * Compress data using simple encoding (can be enhanced with LZ-string library)
 */
export function compressData<T>(data: T): string {
  // For now, just stringify - can be enhanced with actual compression
  return JSON.stringify(data);
}

/**
 * Decompress data
 */
export function decompressData<T>(compressed: string): T {
  return JSON.parse(compressed) as T;
}

/**
 * Clean up old exam/quiz sessions from localStorage
 * Keeps only the most recent N sessions
 */
export function cleanupOldSessions(storageKey: string, maxSessions: number = 10) {
  try {
    const data = localStorage.getItem(storageKey);
    if (!data) return;

    const parsed = JSON.parse(data);
    if (parsed?.state?.sessions && Array.isArray(parsed.state.sessions)) {
      if (parsed.state.sessions.length > maxSessions) {
        // Keep only the most recent sessions
        parsed.state.sessions = parsed.state.sessions.slice(0, maxSessions);
        localStorage.setItem(storageKey, JSON.stringify(parsed));
        console.info(`Cleaned up old sessions, kept ${maxSessions} most recent`);
      }
    }
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
  }
}

/**
 * Monitor localStorage usage and warn if getting full
 */
export function monitorStorageUsage(): void {
  const stats = getStorageStats();

  if (stats.isNearLimit) {
    console.warn(
      `LocalStorage usage: ${stats.usedMB}MB (${stats.percentUsed}% of estimated limit)`
    );
  }
}
