const APP_OFFLINE_LOCK_NAME = "starter-template:offline-data";

export function withAppOfflineLock<T>(operation: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  return locks ? locks.request(APP_OFFLINE_LOCK_NAME, operation) : operation();
}
