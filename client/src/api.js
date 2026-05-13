const API_BASE = `${import.meta.env.VITE_SERVER_URL}/api`;

/**
 * Makes an authenticated API request to the server.
 *
 * Automatically attaches the stored JWT token to the Authorization header.
 * If a 401 response is received, it clears stored credentials and redirects
 * to the login page, unless `options.skipAuthRedirect` is true.
 *
 * @param {string} path - The API endpoint path, relative to the API base URL.
 * @param {object} [options={}] - Fetch options (method, body, headers, etc.).
 * @param {boolean} [options.skipAuthRedirect=false] - If true, prevents automatic redirect on 401.
 * @returns {Promise<object>} The parsed JSON response from the server.
 * @throws {object} An object containing the HTTP status code and error details if the response is not ok.
 */

export async function apiFetch(path, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (response.status === 401 && !options.skipAuthRedirect) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return;
    }
    const data = await response.json();
    if (!response.ok) throw {status: response.status, ...data};

    return data;
}