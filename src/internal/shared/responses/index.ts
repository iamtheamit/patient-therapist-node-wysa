// TODO: Standardize API response payloads and success wrappers.
export interface ApiResponse<T> {
  data: T;
  message?: string;
}
