import axios from 'axios';
import type { UploadResponse, AdminResponse, BingResponse } from '../types';

export const api = axios.create({
  baseURL: '/api'
});

export const getBingImages = async (): Promise<BingResponse> => {
  const { data } = await api.get('/bing');
  return data;
};

export const uploadFile = async (file: File, onProgress?: (percent: number) => void, adminMode: boolean = false, token?: string): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const url = adminMode ? '/admin/upload' : '/upload';
    const config: any = {
      onUploadProgress: (progressEvent: { total?: number, loaded: number }) => {
        const total = progressEvent.total || progressEvent.loaded;
        if (total > 0) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / total);
          if (onProgress) {
            onProgress(percentCompleted);
          }
        }
      }
    };
    if (adminMode && token) {
      config.headers = { Authorization: `Basic ${token}` };
    }

    const { data } = await api.post(url, formData, config);
    return data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      return error.response.data;
    }
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

export const getAdminMedia = async (page: number, token: string, tagId?: number | null): Promise<AdminResponse> => {
  let url = `/manage?page=${page}`;
  if (tagId !== undefined && tagId !== null) {
    url += `&tag_id=${tagId}`;
  }
  const { data } = await api.get(url, {
    headers: {
      Authorization: `Basic ${token}`
    }
  });
  return data;
};

export const getTags = async (): Promise<{ data: import('../types').Tag[] }> => {
  const { data } = await api.get('/tags');
  return data;
};

export const createTag = async (name: string, color: string, token: string): Promise<any> => {
  const { data } = await api.post('/tags', { name, color }, {
    headers: { Authorization: `Basic ${token}` }
  });
  return data;
};

export const deleteTag = async (id: number, token: string): Promise<any> => {
  const { data } = await api.delete(`/tags/${id}`, {
    headers: { Authorization: `Basic ${token}` }
  });
  return data;
};

export const batchTagMedia = async (urls: string[], tagId: number | null, token: string): Promise<any> => {
  const { data } = await api.patch('/media/batch-tag', { urls, tag_id: tagId }, {
    headers: { Authorization: `Basic ${token}` }
  });
  return data;
};

export const triggerBingCrawl = async (token: string): Promise<any> => {
  const { data } = await api.post('/cron/bing', {}, {
    headers: { Authorization: `Basic ${token}` }
  });
  return data;
};

export const deleteAdminMedia = async (urls: string[], token: string): Promise<{ message?: string; error?: string }> => {
  try {
    const { data } = await api.post('/delete', urls, {
      headers: {
        Authorization: `Basic ${token}`
      }
    });
    return data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      return error.response.data;
    }
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
};
