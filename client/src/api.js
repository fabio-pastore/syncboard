const API_BASE = 'http://localhost:3001/api';

export async function apiFetch(path, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const repose = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const data = await repose.json();
    if (!repose.ok) throw {status: repose.status, ...data};

    return data;
}