import axios from 'axios';

// ── Base axios instance ───────────────────────────────────────────────────────
const api = axios.create({
    baseURL: '/api',
    headers: { 'Content-Type': 'application/json' },
});

// ── Attach token to every request automatically ───────────────────────────────
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// ── Handle expired token globally ────────────────────────────────────────────
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // if (error.response?.status === 401) {
        if (error.response?.status === 401 && !error.config.url.includes('/login')) { // added !error.config.url.includes('/login') 'cause it redirects to login page even when already on login page
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (email, password) =>
    api.post('/auth/login', { email, password });

export const getMe = () =>
    api.get('/auth/me');

export const getUsers = () =>
    api.get('/auth/users');

export const createUser = (data) =>
    api.post('/auth/users', data);

export const updateUser = (id, data) =>
    api.put(`/auth/users/${id}`, data);

// ── Tickets ───────────────────────────────────────────────────────────────────
export const getTickets = (params) =>
    api.get('/tickets', { params });

export const getTicket = (id) =>
    api.get(`/tickets/${id}`);

export const getTicketsSummary = () =>
    api.get('/tickets/summary');

export const getArchive = () =>
    api.get('/tickets/archive');

export const getChangeHistory = () =>
    api.get('/tickets/changes');

export const updateTicket = (id, data) =>
    api.put(`/tickets/${id}`, data);

// ── Import ────────────────────────────────────────────────────────────────────
export const importExcel = (formData, onProgress) =>
    api.post('/import/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
            if (onProgress) onProgress(Math.round((e.loaded * 100) / e.total));
        },
    });

export const getImportLogs = () =>
    api.get('/import/logs');

// ── Reports ───────────────────────────────────────────────────────────────────
export const getTeamWiseReport = (params) =>
    api.get('/reports/team-wise', { params });

export const getOverallReport = (params) =>
    api.get('/reports/overall', { params });

export const getSummaryReport = (params) =>
    api.get('/reports/summary', { params });

export const getTrendReport = () =>
    api.get('/reports/trend');

export const getDailyMovementReport = (params) =>
    api.get('/reports/daily-movement', { params });

// ── User ───────────────────────────────────────────────────────────────────
export const changePassword = (data) =>
    api.put('/auth/change-password', data);

export const resetUserPassword = (id, new_password) =>
    api.put(`/auth/reset-password/${id}`, { new_password });

export default api;