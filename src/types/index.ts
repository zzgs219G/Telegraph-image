export interface MediaItem {
  url: string;
  fileId: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface AdminResponse {
  data: MediaItem[];
  pagination: Pagination;
}

export interface UploadResponse {
  data?: string;
  error?: string;
}

export interface BingResponse {
  status: boolean;
  message: string;
  data: { url: string }[];
}

export interface CachedUpload {
  url: string;
  fileName: string;
  hash: string;
  timestamp: string;
}
