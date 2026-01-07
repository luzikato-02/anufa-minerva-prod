// Profile routes stub for Electron build

type RouteFunction = () => string;

const createRoute = (path: string): RouteFunction => () => path;

export const profile = createRoute('/settings/profile');
export const edit = createRoute('/settings/profile');
export const profileUpdate = createRoute('/settings/profile');
export const profileDestroy = createRoute('/settings/profile');
