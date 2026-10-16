export function productionEndpoints(hostname: string) {
    for (const domain of ['fluentxverse.com', 'fluentxverse.xyz']) {
        if (['', 'www.', 'student.', 'tutor.', 'dashboard.'].some(prefix => hostname === prefix + domain)) {
            return { apiUrl: `https://api.${domain}`, socketUrl: `https://ws.${domain}` };
        }
    }
    return undefined;
}

export function studentEndpoints(hostname: string, apiOverride = '', socketOverride = '') {
    const production = productionEndpoints(hostname);
    if (production) {
        // Legacy frontend hosts also use the active .com backend tunnels.
        return { apiUrl: 'https://api.fluentxverse.com', socketUrl: 'https://ws.fluentxverse.com' };
    }
    return {
        apiUrl: apiOverride.trim().replace(/\/+$/, '') || 'http://127.0.0.1:8780',
        socketUrl: socketOverride.trim().replace(/\/+$/, '').replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:') || 'http://127.0.0.1:8781',
    };
}
