// Password routes stub for Electron build

type RouteFunction = () => string;

const createRoute = (path: string): RouteFunction => () => path;

export const password = createRoute('/settings/password');
export const edit = createRoute('/settings/password');
export const request = createRoute('/forgot-password');
export const passwordUpdate = createRoute('/settings/password');
