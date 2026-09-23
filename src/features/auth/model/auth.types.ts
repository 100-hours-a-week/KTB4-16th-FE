export interface LoginValues {
  email: string;
  password: string;
}

export interface SignupValues extends LoginValues {
  nickname: string;
  passwordConfirm: string;
}

export type AuthField = keyof SignupValues;
export type AuthFieldErrors = Partial<Record<AuthField, string>>;

export interface LoginResponse {
  message: string;
  accessToken: string;
}

export interface SignupResponse {
  message: string;
}
