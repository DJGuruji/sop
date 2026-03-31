export type ApiSuccess<T> = {
  success: true;
  data: T;
  message?: string;
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export function ok<T>(data: T, message?: string): ApiSuccess<T> {
  return message ? { success: true, data, message } : { success: true, data };
}

export function fail(code: string, message: string): ApiError {
  return { success: false, error: { code, message } };
}

