// Token refresh functions are disabled for this client build

export function clearTokenRefresh() {
  // no-op
}

export async function setupTokenRefresh() {
  return;
}

export async function refreshAccessToken() {
  return null;
}

export async function fetchWithAutoRefresh<T>(fetchFn: () => Promise<T>): Promise<T> {
  // direct passthrough without auto-refresh
  return fetchFn();
}
