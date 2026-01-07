// Email verification routes stub for Electron build

type RouteFunction = () => string;

const createRoute = (path: string): RouteFunction => () => path;

export const send = createRoute('/email/verification-notification');
export const verify = createRoute('/verify-email');
