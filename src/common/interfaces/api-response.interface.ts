export interface CustomApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  metadata?: {
    timestamp: string;
    path: string;
  };
}
