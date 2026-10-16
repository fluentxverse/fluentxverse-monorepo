// Paid UI is opt-in; the API independently selects and enforces booking mode.
export const TICKETING_VISIBLE = import.meta.env.VITE_ENABLE_TICKETING === 'true';
