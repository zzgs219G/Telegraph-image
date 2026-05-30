import type { UploadResponse, AdminResponse, BingResponse } from '../types';

export const getBingImages = async (): Promise<BingResponse> => {
  const res = await fetch('/api/bing');
  return await res.json();
};

export const uploadFile = async (file: File, onProgress?: (percent: number) => void): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    return await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload');

      xhr.upload.onprogress = (progressEvent) => {
        if (progressEvent.lengthComputable && onProgress) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      };

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data);
        } catch (e) {
          reject(e);
        }
      };

      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(formData);
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

export const getAdminMedia = async (page: number, token: string): Promise<AdminResponse> => {
  const res = await fetch(`/api/manage?page=${page}`, {
    headers: {
      Authorization: `Basic ${token}`
    }
  });
  return await res.json();
};

export const deleteAdminMedia = async (urls: string[], token: string): Promise<{ message?: string; error?: string }> => {
  try {
    const res = await fetch('/api/delete', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(urls)
    });
    return await res.json();
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
};
