/**
 * Detects an expired login on any request the app makes and tells the UI.
 *
 * Hooked once at startup (see `installSessionExpiredDetection`) so the many
 * fetch/axios/Inertia call sites don't each have to handle it.
 */
import { router } from '@inertiajs/react';
import axios from 'axios';
import { capturePendingWrite } from './pending-writes';

type Listener = (expired: boolean) => void;

const listeners = new Set<Listener>();
let expired = false;

/** Pages a signed-out user is expected to see; a 401/419 there is not an expiry. */
const GUEST_PATHS = /^\/(login|register|forgot-password|reset-password|two-factor-challenge|email|confirm-password)/;

export function isSessionExpired(): boolean {
    return expired;
}

export function subscribeSessionExpired(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function markExpired(status: number): void {
    // 401: login gone. 419: CSRF/session mismatch, which is what an expired session looks like on a POST.
    if ((status !== 401 && status !== 419) || expired || GUEST_PATHS.test(window.location.pathname)) return;
    expired = true;
    listeners.forEach((l) => l(true));
}

function isSameOrigin(input: RequestInfo | URL): boolean {
    const raw = input instanceof Request ? input.url : input.toString();
    return new URL(raw, window.location.href).origin === window.location.origin;
}

let installed = false;

export function installSessionExpiredDetection(): void {
    if (installed) return;
    installed = true;

    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
        const res = await nativeFetch(input, init);
        if (isSameOrigin(input)) {
            if (res.status === 401 || res.status === 419) {
                const url = input instanceof Request ? input.url : input.toString();
                capturePendingWrite(init?.method ?? (input instanceof Request ? input.method : 'GET'), url, init?.body);
            }
            markExpired(res.status);
        }
        return res;
    };

    axios.interceptors.response.use(undefined, (error) => {
        if (axios.isAxiosError(error) && error.response) {
            const { status } = error.response;
            const { config } = error;
            if ((status === 401 || status === 419) && config?.url) {
                capturePendingWrite(config.method ?? 'GET', new URL(config.url, config.baseURL ?? window.location.href).href, config.data);
            }
            markExpired(status);
        }
        return Promise.reject(error);
    });

    // Inertia page visits: a 419 comes back as a non-Inertia response.
    router.on('invalid', (event) => {
        const status = event.detail.response.status;
        if (status === 401 || status === 419) {
            event.preventDefault();
            markExpired(status);
        }
    });
}
