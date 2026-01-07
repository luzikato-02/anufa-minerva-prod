// Password confirm routes stub for Electron build

type RouteFunction = () => string;

const createRoute = (path: string): RouteFunction => () => path;

export const store = createRoute('/confirm-password');
export const show = createRoute('/confirm-password');
