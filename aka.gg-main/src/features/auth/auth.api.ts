import { axiosInstance } from '@/lib/axios';
import { LoginRequest, RegisterRequest, AuthResponse } from './types';

// Mock functions for now - replace with real API calls when backend is ready
export const authApi = {
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    // TODO: Replace with real API call when backend is ready
    // const response = await axiosInstance.post('/auth/login', credentials);
    // return response.data;
    
    // Mock implementation for development
    if (!import.meta.env.VITE_API_URL) {
      // Mock successful login
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            token: 'mock-jwt-token-' + Date.now(),
            user: {
              id: '1',
              name: 'Usuario Demo',
              email: credentials.email
            }
          });
        }, 1000);
      });
    }

    const response = await axiosInstance.post('/auth/login', credentials);
    return response.data;
  },

  async register(userData: RegisterRequest): Promise<void> {
    // TODO: Replace with real API call when backend is ready
    // const response = await axiosInstance.post('/auth/register', userData);
    // return response.data;
    
    // Mock implementation for development
    if (!import.meta.env.VITE_API_URL) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, 1000);
      });
    }

    await axiosInstance.post('/auth/register', userData);
  },

  async logout(): Promise<void> {
    // TODO: Replace with real API call when backend is ready
    // await axiosInstance.post('/auth/logout');
    
    // Clear local storage
    localStorage.removeItem('access_token');
  }
};