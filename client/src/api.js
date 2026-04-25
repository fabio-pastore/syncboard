const API_BASE = `${import.meta.env.VITE_SERVER_URL}/api`;

export async function apiFetch(path, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const data = await response.json();
    if (!response.ok) throw {status: response.status, ...data};

    return data;
}