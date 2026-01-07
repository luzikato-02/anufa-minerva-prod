// Appearance routes stub for Electron build

type RouteFunction = () => string;

const createRoute = (path: string): RouteFunction => () => path;

export const appearance = createRoute('/settings/appearance');
export const edit = createRoute('/settings/appearance');
