// Two-factor login routes stub for Electron build

type RouteFunction = () => string;

const createRoute = (path: string): RouteFunction => () => path;

export const store = createRoute('/two-factor-challenge');
export const show = createRoute('/two-factor-challenge');
