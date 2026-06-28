export interface User {
  id: number | string;
  name: string;
  email: string;
  role?: 'user' | 'admin';
  avatar_url?: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user?: User;
}