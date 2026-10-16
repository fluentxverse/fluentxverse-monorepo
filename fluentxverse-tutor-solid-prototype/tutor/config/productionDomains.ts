export function productionEndpoints(hostname: string) {
    for (const domain of ['fluentxverse.com', 'fluentxverse.xyz']) {
        if (['', 'www.', 'student.', 'tutor.', 'dashboard.'].some(prefix => hostname === prefix + domain)) {
            return { apiUrl: `https://api.${domain}`, socketUrl: `https://ws.${domain}` };
        }
    }
    return undefined;
}

export function tutorEndpoints(hostname: string, apiOverride = '', socketOverride = '') {
    if (productionEndpoints(hostname)) {
        return { apiUrl: 'https://api.fluentxverse.com', socketUrl: 'https://ws.fluentxverse.com' };
    }
    return {
        apiUrl: apiOverride.trim().replace(/\/+$/, '') || 'http://127.0.0.1:8782',
        socketUrl: socketOverride.trim().replace(/\/+$/, '').replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:') || 'http://127.0.0.1:8783',
    };
}
