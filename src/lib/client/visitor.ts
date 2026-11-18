"use client";

const DEVICE_KEY = "tf.deviceId";
const NAME_KEY = "tf.authorName";

let memoryDeviceId: string | null = null;

/**
 * Random anonymous ID stored on this device. Lets the server rate-limit and lets
 * people edit their own posts later. Falls back to an in-memory ID if storage is blocked.
 */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    memoryDeviceId ??= crypto.randomUUID();
    return memoryDeviceId;
  }
}

export function getSavedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveName(name: string) {
  try {
    if (name.trim()) localStorage.setItem(NAME_KEY, name.trim());
    else localStorage.removeItem(NAME_KEY);
  } catch {
    // Storage blocked: nothing to remember.
  }
}

/** fetch() with the anonymous device header. */
export function apiFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-device-id", getDeviceId());
  return fetch(input, { ...init, headers });
}
