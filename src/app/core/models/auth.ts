export interface User {
  id: string;
  name: string;
  role: 'student' | 'lecturer' | 'admin';
  email: string;
}
export interface Tokens {
  accessToken: string;
  refreshToken?: string;
}
export interface Envelope<T> {
  success: boolean;
  code: string | null;
  message: string | null;
  data: T;
}
export interface LoginReq {
  email: string;
  password: string;
  remember: boolean;
}
export interface LoginData {
  accessToken: string;
  refreshToken: string;
  userId: number;
  fullName: string;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
}
