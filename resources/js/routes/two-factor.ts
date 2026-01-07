// Two-factor authentication routes stub for Electron build

type RouteFunction = () => string;

const createRoute = (path: string): RouteFunction => () => path;

export const twoFactor = createRoute('/settings/two-factor');
export const show = createRoute('/settings/two-factor');
export const enable = createRoute('/settings/two-factor/enable');
export const disable = createRoute('/settings/two-factor/disable');
export const qrCode = createRoute('/settings/two-factor/qr-code');
export const secretKey = createRoute('/settings/two-factor/secret-key');
export const recoveryCodes = createRoute('/settings/two-factor/recovery-codes');
export const regenerateRecoveryCodes = createRoute('/settings/two-factor/recovery-codes');
export const confirm = createRoute('/settings/two-factor/confirm');
export const store = createRoute('/settings/two-factor/store');
