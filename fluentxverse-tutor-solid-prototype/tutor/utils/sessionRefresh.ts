export function startClassroomSessionRefresh(active: boolean, renew: () => Promise<unknown>, onRenewed: () => void) {
    if (!active)
        return;
    let disposed = false, inFlight = false, stopped = false, nextAttemptAt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
        if (disposed || stopped || inFlight || Date.now() < nextAttemptAt)
            return;
        if (timer)
            clearTimeout(timer);
        inFlight = true;
        let delay = 10 * 60 * 1000;
        try {
            await renew();
            if (!disposed)
                onRenewed();
        }
        catch (error: any) {
            if (error?.response?.status === 401 || error?.response?.status === 403)
                stopped = true;
            delay = 30 * 1000;
        }
        finally {
            inFlight = false;
            nextAttemptAt = Date.now() + delay;
            if (!disposed && !stopped)
                timer = setTimeout(() => { void refresh(); }, delay);
        }
    };
    const onWake = () => { void refresh(); };
    const onVisible = () => { if (document.visibilityState === 'visible')
        onWake(); };
    window.addEventListener('focus', onWake);
    window.addEventListener('online', onWake);
    document.addEventListener('visibilitychange', onVisible);
    void refresh();
    return () => {
        disposed = true;
        if (timer)
            clearTimeout(timer);
        window.removeEventListener('focus', onWake);
        window.removeEventListener('online', onWake);
        document.removeEventListener('visibilitychange', onVisible);
    };
}
