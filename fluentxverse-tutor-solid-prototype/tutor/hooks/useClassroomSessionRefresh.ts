import { createEffect, on, onCleanup, type Accessor } from 'solid-js';
import { startClassroomSessionRefresh } from '../utils/sessionRefresh';
export function useClassroomSessionRefresh(active: Accessor<boolean>, renew: () => Promise<unknown>, onRenewed: () => void) {
    createEffect(on(active, enabled => {
        const cleanup = startClassroomSessionRefresh(enabled, renew, onRenewed);
        if (cleanup)
            onCleanup(cleanup);
    }));
}
