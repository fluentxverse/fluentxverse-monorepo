import { createEffect, createMemo, createSignal, on, onCleanup, Show, type Component } from 'solid-js';
import { useAuthContext } from '../context/AuthContext';
import { useLocation } from '../routing';
import LoadingSpinner from './LoadingSpinner';
import { proofApi } from '../api/proof.api';
import { useParams } from '@solidjs/router';
import StatusPanel from '../../../shared/ui/StatusPanel';
import { hasTeachingAccess } from '../utils/teachingAccess';
export function ProtectedRoute(props: {
    Component: Component<any>;
}) {
    const params = useParams();
    const auth = useAuthContext();
    const location = useLocation();
    const pending = createMemo(() => auth.initialLoading || auth.loginLoading);
    const authenticated = createMemo(() => auth.isAuthenticated);
    createEffect(() => {
        if (!pending() && !authenticated() && !auth.logoutLoading)
            location.route('/');
    });
    return <Show when={!pending()} fallback={<LoadingSpinner />}><Show when={authenticated()}><props.Component {...params}/></Show></Show>;
}
export const withProtected = (component: Component<any>) => () => <ProtectedRoute Component={component}/>;
export function CertifiedRoute(props: {
    Component: Component<any>;
}) {
    const params = useParams();
    const auth = useAuthContext();
    const location = useLocation();
    const [loading, setLoading] = createSignal(true);
    const [certified, setCertified] = createSignal(false);
    const [error, setError] = createSignal(false);
    const [revision, setRevision] = createSignal(0);
    createEffect(on(() => [auth.user?.userId, auth.initialLoading, auth.logoutLoading, revision()] as const, ([userId, initialLoading, logoutLoading]) => {
        let active = true;
        onCleanup(() => { active = false; });
        if (!userId || initialLoading || logoutLoading)
            return;
        setLoading(true);
        setCertified(false);
        setError(false);
        void proofApi.getTutorCertificationStatus().then(result => {
            if (!active)
                return;
            if (hasTeachingAccess(result))
                setCertified(true);
            else
                location.route('/home?certification=required', true);
        }).catch(() => {
            if (active) setError(true);
        })
            .finally(() => {
            if (active)
                setLoading(false);
        });
    }));
    return <ProtectedRoute Component={() => <Show when={!loading()} fallback={<LoadingSpinner />}><Show when={!error()} fallback={<div class="fxv-route-state"><StatusPanel kind="error" title="Could not verify certification" message="Your session is unchanged. Please try again." onRetry={() => setRevision(value => value + 1)}/></div>}><Show when={certified()}><props.Component {...params}/></Show></Show></Show>}/>;
}
export const withCertified = (component: Component<any>) => () => <CertifiedRoute Component={component}/>;
