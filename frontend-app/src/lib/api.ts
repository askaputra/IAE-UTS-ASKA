import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor (ini sudah benar)
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// API untuk Autentikasi
export const authApi = {
  login: (data: { email: string; password: string }) => 
    apiClient.post('/api/auth/login', data),
  
  register: (data: { name: string; email: string; password: string }) => 
    apiClient.post('/api/auth/register', data),
    
  getUsers: () => apiClient.get('/api/users'), 

  joinTeam: (data: { teamId: string }) =>
    apiClient.put('/api/users/join-team', data),

  // FUNGSI BARU DITAMBAHKAN:
  checkToken: () => apiClient.get('/api/auth/check-token'),
};