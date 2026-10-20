export interface LessonNotice {
    id: string;
    title: string;
    message: string;
    timestamp: string;
    isRead: boolean;
    data?: { link?: string };
}

export async function fetchNotificationFeed(
    request: () => Promise<{ data: { success?: boolean; data?: { notifications?: LessonNotice[] } } }>,
    signal: AbortSignal,
    wait = (ms: number) => new Promise<void>((resolve, reject) => {
        const aborted = () => { clearTimeout(timer); reject(signal.reason); };
        const timer = setTimeout(() => { signal.removeEventListener('abort', aborted); resolve(); }, ms);
        signal.addEventListener('abort', aborted, { once: true });
        if (signal.aborted) aborted();
    }),
): Promise<LessonNotice[]> {
    for (let attempt = 0; ; attempt++) {
        signal.throwIfAborted();
        try {
            const { data } = await request();
            signal.throwIfAborted();
            if (!data.success || !Array.isArray(data.data?.notifications))
                throw new Error('Notifications unavailable');
            return data.data.notifications;
        } catch (error) {
            const status = (error as { response?: { status?: number } })?.response?.status;
            // Retry transient transport/server failures, not authentication or rejected requests.
            if (signal.aborted || attempt > 0 || (status !== undefined && status < 500 && status !== 429))
                throw error;
            await wait(600);
        }
    }
}
