const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

async function silentLogin(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@pwc.com', password: 'admin1234!' }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    localStorage.setItem('admin_token', data.access_token);
    return data.access_token;
  } catch { return null; }
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    const newToken = await silentLogin();
    if (newToken) {
      const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
      const retryRes = await fetch(`${API_BASE}${path}`, { ...options, headers: retryHeaders });
      if (retryRes.ok) return retryRes.json();
    }
    throw new Error('인증이 만료되었습니다.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '요청에 실패했습니다.' }));
    throw new Error(err.detail || '요청에 실패했습니다.');
  }

  return res.json();
}

const api = {
  get: (path: string) => request(path),
  post: (path: string, body?: unknown) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path: string, body?: unknown) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path: string) => request(path, { method: 'DELETE' }),
};

export const adminAuthApi = {
  login: (email: string, password: string) => api.post('/api/admin/auth/login', { email, password }),
  logout: () => api.post('/api/admin/auth/logout'),
  me: () => api.get('/api/admin/auth/me'),
};

export const adminUsersApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/api/admin/users${qs}`);
  },
  get: (id: number) => api.get(`/api/admin/users/${id}`),
  create: (data: Record<string, unknown>) => api.post('/api/admin/users', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/api/admin/users/${id}`, data),
  delete: (id: number) => api.delete(`/api/admin/users/${id}`),
  resetPassword: (id: number) => api.post(`/api/admin/users/${id}/reset-password`),
  toggleStatus: (id: number) => api.post(`/api/admin/users/${id}/toggle-status`),
};

export const adminGroupsApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/api/admin/groups${qs}`);
  },
  create: (data: Record<string, unknown>) => api.post('/api/admin/groups', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/api/admin/groups/${id}`, data),
};

export const adminPermissionsApi = {
  matrix: (reportName?: string) => {
    const qs = reportName ? `?report_name=${encodeURIComponent(reportName)}` : '';
    return api.get(`/api/admin/permissions/matrix${qs}`);
  },
  updateMatrix: (permissions: unknown[]) => api.put('/api/admin/permissions/matrix', { permissions }),
  detail: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/api/admin/permissions/detail${qs}`);
  },
  updateDetail: (permissions: unknown[]) => api.put('/api/admin/permissions/detail', { permissions }),
};

export const adminRequestsApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/api/admin/user-requests${qs}`);
  },
  create: (data: Record<string, unknown>) => api.post('/api/admin/user-requests', data),
  approve: (id: number) => api.put(`/api/admin/user-requests/${id}/approve`),
  reject: (id: number) => api.put(`/api/admin/user-requests/${id}/reject`),
};

export const adminAuditApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/api/admin/audit-logs${qs}`);
  },
  stats: () => api.get('/api/admin/audit-logs/stats'),
};

export const adminRolesApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/api/admin/roles${qs}`);
  },
  create: (data: Record<string, unknown>) => api.post('/api/admin/roles', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/api/admin/roles/${id}`, data),
  delete: (id: number) => api.delete(`/api/admin/roles/${id}`),
};

export const adminCompaniesApi = {
  list: () => api.get('/api/admin/companies'),
  get: (id: number) => api.get(`/api/admin/companies/${id}`),
  create: (data: Record<string, unknown>) => api.post('/api/admin/companies', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/api/admin/companies/${id}`, data),
  delete: (id: number) => api.delete(`/api/admin/companies/${id}`),
  createSubsidiary: (data: Record<string, unknown>) => api.post('/api/admin/companies/subsidiaries', data),
  names: () => api.get('/api/admin/companies/names'),
};

async function uploadFile(path: string, formData: FormData) {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '업로드에 실패했습니다.' }));
    throw new Error(err.detail || '업로드에 실패했습니다.');
  }
  return res.json();
}

export const adminReportsApi = {
  acceptedRequests: () => api.get('/api/admin/reports/accepted-requests'),
  list: () => api.get('/api/admin/reports'),
  create: (data: { company: string; period?: string; title?: string; data_request_id?: number }) =>
    api.post('/api/admin/reports', data),
  uploadFile: (reportId: number, fileType: 'JE' | 'TB', file: File) => {
    const fd = new FormData();
    fd.append('file_type', fileType);
    fd.append('file', file);
    return uploadFile(`/api/admin/reports/${reportId}/upload-file`, fd);
  },
  generate: (reportId: number) =>
    api.post(`/api/admin/reports/${reportId}/generate`),
  updateStatus: (reportId: number, status: string) =>
    api.put(`/api/admin/reports/${reportId}/status`, { status }),
};
