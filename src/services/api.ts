import axios from 'axios';
import type { UploadResponse, AdminResponse, BingResponse } from '../types';

export const api = axios.create({
  baseURL: '/api'
});

export const getBingImages = async (): Promise<BingResponse> => {
  const { data } = await api.get('/bing');
  return data;
};

export const uploadFile = async (file: File, onProgress?: (percent: number) => void): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const { data } = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          if (onProgress) {
            onProgress(percentCompleted);
          }
        }
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

export const getAdminMedia = async (page: number, token: string): Promise<AdminResponse> => {
  const { data } = await api.get(`/manage?page=${page}`, {
    headers: {
      Authorization: `Basic ${token}`
    }
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
