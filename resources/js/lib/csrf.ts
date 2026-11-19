/**
 * Refreshes the XSRF-TOKEN cookie and returns its value, for sending as the
 * `X-XSRF-TOKEN` header on state-changing requests.
 */
export async function fetchXsrfToken(): Promise<string> {
    await fetch(`${window.location.origin}/csrf-token`, {
        credentials: 'include',
    });
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}
