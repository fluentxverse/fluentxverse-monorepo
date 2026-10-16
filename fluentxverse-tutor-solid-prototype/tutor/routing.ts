import { useLocation as solidLocation, useNavigate, useParams, useSearchParams } from '@solidjs/router';
export function useLocation() {
    const location = solidLocation();
    const navigate = useNavigate();
    return {
        get path() { return location.pathname; },
        get url() { return location.pathname + location.search; },
        get search() { return location.search; },
        get hash() { return location.hash; },
        route: (url: string, replace = false) => navigate(url, { replace }),
    };
}
export function useRoute() {
    const params = useParams();
    const [query] = useSearchParams();
    return { params, query };
}
