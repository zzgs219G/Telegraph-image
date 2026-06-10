export interface Tag {
  id: number;
  name: string;
  color: string;
  count?: number;
}

export interface MediaItem {
  url: string;
  fileId: string;
  tag_id?: number;
  filename?: string;
  size?: number;
  created_at?: number;
  tag?: Tag;
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
