import React, { useState, useEffect, useRef } from 'react';

interface CacheItem {
  url: string;
  fileName: string;
  hash: string;
  timestamp: string;
}

interface ThumbnailItem {
  previewUrl: string;
  url: string;
  file: File | null;
  type: string;
  ext: string;
}

export default function Uploader() {
  const [originalImageURLs, setOriginalImageURLs] = useState<string[]>([]);
  const [thumbnailData, setThumbnailData] = useState<ThumbnailItem[]>([]);
  const [enableCompression, setEnableCompression] = useState(true);
  const [isCacheVisible, setIsCacheVisible] = useState(false);
  const [cacheData, setCacheData] = useState<CacheItem[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ show: boolean; text: string }>({ show: false, text: '' });
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileLinkRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const loadedCache = JSON.parse(localStorage.getItem('uploadCache') || '[]');
    setCacheData(loadedCache);
  }, []);

  const calculateFileHash = async (file: File) => {
    const chunkSize = 1024 * 1024;
    const chunk = file.size > chunkSize ? file.slice(0, chunkSize) : file;
    const arrayBuffer = await chunk.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
    return hash + '-' + file.size + '-' + file.lastModified;
  };

  const compressImage = async (file: File, quality = 0.75): Promise<File> => {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file);
        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0, image.width, image.height);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          } else {
            resolve(file);
          }
        }, 'image/jpeg', quality);
      };
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          image.src = e.target.result as string;
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const saveToLocalCache = (url: string, fileName: string, fileHash: string) => {
    const timestamp = new Date().toLocaleString('zh-CN', { hour12: false });
    const newCacheItem = { url, fileName, hash: fileHash, timestamp };
    const updatedCache = [...cacheData, newCacheItem];
    setCacheData(updatedCache);
    localStorage.setItem('uploadCache', JSON.stringify(updatedCache));
  };

  const handleFileSelection = async (files: FileList | File[]) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileHash = await calculateFileHash(file);
      const cached = cacheData.find(item => item.hash === fileHash);

      if (cached) {
        if (!originalImageURLs.includes(cached.url)) {
          setOriginalImageURLs(prev => [...prev, cached.url]);
        }
      } else {
        await uploadFile(file, fileHash);
      }
    }
  };

  const uploadFile = async (file: File, fileHash: string) => {
    const originalFile = file;
    try {
      let fileToUpload = file;
      if (file.type.startsWith('image/') && file.type !== 'image/gif' && enableCompression) {
        fileToUpload = await compressImage(file);
      }

      const formData = new FormData();
      formData.append('file', fileToUpload, fileToUpload.name);

      setUploadProgress({ show: true, text: '上传中... 0%' });

      const xhr = new XMLHttpRequest();
      const uploadPromise = new Promise<any>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            setUploadProgress({ show: true, text: `上传中... ${percentComplete}%` });
          }
        });
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              reject(new Error('响应解析失败'));
            }
          } else {
            try {
              const err = JSON.parse(xhr.responseText);
              reject(new Error(err.error || '上传失败'));
            } catch {
              reject(new Error(`上传失败: HTTP ${xhr.status}`));
            }
          }
        };
        xhr.onerror = () => reject(new Error('网络错误，请检查网络连接'));
        xhr.ontimeout = () => reject(new Error('上传超时，请重试'));
        xhr.open('POST', '/upload');
        xhr.timeout = 120000;
        xhr.send(formData);
      });

      const responseData = await uploadPromise;
      setUploadProgress({ show: false, text: '' });

      if (responseData.error) {
        alert(responseData.error);
      } else {
        const url = responseData.data;
        setOriginalImageURLs(prev => [...prev, url]);

        const previewUrl = URL.createObjectURL(originalFile);
        setThumbnailData(prev => [...prev, {
          previewUrl,
          url,
          file: originalFile,
          type: originalFile.type,
          ext: originalFile.name.split('.').pop()?.toUpperCase() || 'FILE'
        }]);

        saveToLocalCache(url, originalFile.name, fileHash);
      }
    } catch (error: any) {
      setUploadProgress({ show: false, text: '' });
      alert(error.message || '处理文件时出现错误');
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      handleFileSelection(files);
    }
  };

  const formatLinks = (urls: string[], format: string) => {
    switch (format) {
      case 'url': return urls.join('\n\n');
      case 'bbcode': return urls.map(url => `[img]${url}[/img]`).join('\n\n');
      case 'markdown': return urls.map(url => `![image](${url})`).join('\n\n');
      default: return urls.join('\n');
    }
  };

  const copyToClipboard = (format: string) => {
    const urls = originalImageURLs.map(url => url.trim()).filter(url => url !== '');
    if (urls.length === 0) return;
    const formatted = formatLinks(urls, format);
    navigator.clipboard.writeText(formatted).then(() => {
      alert('已复制到剪贴板');
    }).catch(() => alert('复制失败'));
  };

  const removeThumbnail = (index: number) => {
    const item = thumbnailData[index];
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);

    setThumbnailData(prev => prev.filter((_, i) => i !== index));
    setOriginalImageURLs(prev => prev.filter(url => url !== item.url));
  };

  const adjustTextareaHeight = () => {
    if (fileLinkRef.current) {
      fileLinkRef.current.style.height = '1px';
      fileLinkRef.current.style.height = Math.min(fileLinkRef.current.scrollHeight, 200) + 'px';
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [originalImageURLs]);

  const loadFromCache = (url: string) => {
    setOriginalImageURLs([url]);
  };

  return (
    <div
      className={`bg-white/90 backdrop-blur-md rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] p-8 w-11/12 max-w-[480px] text-center mx-auto relative transition-colors ${isDragging ? 'bg-white/95' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleFileSelection(e.dataTransfer.files);
        }
      }}
      onPaste={handlePaste}
    >
      <div className="text-[28px] font-bold bg-gradient-to-r from-[#667eea] to-[#764ba2] bg-clip-text text-transparent mb-5 tracking-wide">
        Telegraph图床
      </div>

      <button
        className="absolute top-4 right-4 bg-transparent border-none text-[#667eea]/50 cursor-pointer text-[22px] transition-all hover:text-[#667eea] hover:scale-110"
        title="查看历史记录"
        onClick={() => setIsCacheVisible(!isCacheVisible)}
      >
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
      </button>
      <button
        className="absolute top-4 right-12 bg-transparent border-none text-[#667eea]/50 cursor-pointer text-[22px] transition-all hover:text-[#667eea] hover:scale-110"
        title={enableCompression ? "关闭压缩" : "开启压缩"}
        onClick={() => setEnableCompression(!enableCompression)}
      >
        {enableCompression ? (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm9 4a1 1 0 10-2 0v2H9a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
        ) : (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V9zM7 9a1 1 0 10-2 0v4a1 1 0 102 0V9z" clipRule="evenodd" /></svg>
        )}
      </button>

      <div className="mt-5">
        <div className="relative border-2 border-dashed border-[#667eea] rounded-xl bg-[#667eea]/5 p-6 hover:border-[#764ba2] hover:bg-[#667eea]/10 transition-colors">
          <input
            type="file"
            multiple
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={(e) => e.target.files && handleFileSelection(e.target.files)}
            ref={fileInputRef}
          />
          <div className="text-[#667eea] font-medium">点击选择文件</div>
        </div>

        <div className="text-[#999] text-sm mt-4 leading-relaxed">
          支持拖拽上传 · 多文件上传 · Ctrl+V 粘贴上传
        </div>

        {uploadProgress.show && (
          <div className="mt-4 text-center">
            <div className="text-sm font-medium text-[#667eea] tracking-wide">{uploadProgress.text}</div>
          </div>
        )}

        {originalImageURLs.length > 0 && !isCacheVisible && (
          <>
            <div className="mt-5 flex justify-center gap-2">
              <button onClick={() => copyToClipboard('url')} className="px-4 py-2 rounded-lg font-medium transition-transform hover:-translate-y-0.5 active:translate-y-0 bg-gray-100 hover:bg-gray-200">URL</button>
              <button onClick={() => copyToClipboard('bbcode')} className="px-4 py-2 rounded-lg font-medium transition-transform hover:-translate-y-0.5 active:translate-y-0 bg-gray-100 hover:bg-gray-200">BBCode</button>
              <button onClick={() => copyToClipboard('markdown')} className="px-4 py-2 rounded-lg font-medium transition-transform hover:-translate-y-0.5 active:translate-y-0 bg-gray-100 hover:bg-gray-200">Markdown</button>
            </div>
            <div className="mt-4">
              <textarea
                ref={fileLinkRef}
                readOnly
                value={originalImageURLs.join('\n\n')}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:outline-none resize-none overflow-y-auto max-h-[200px]"
              />
            </div>
          </>
        )}

        {thumbnailData.length > 0 && !isCacheVisible && (
          <div className="flex flex-wrap gap-2 mt-4 justify-center">
            {thumbnailData.map((item, index) => (
              <div key={index} className="relative w-20 h-20 rounded-lg overflow-hidden shadow-sm hover:scale-105 transition-transform group">
                {item.type.startsWith('image/') ? (
                  <img src={item.previewUrl} alt="thumb" className="w-full h-full object-cover" />
                ) : item.type.startsWith('video/') ? (
                  <video src={item.previewUrl} muted className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white font-bold text-lg">
                    {item.ext}
                  </div>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); removeThumbnail(index); }}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white border-none cursor-pointer text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="移除"
                >×</button>
              </div>
            ))}
          </div>
        )}

        {isCacheVisible && (
          <div className="mt-5 max-h-[250px] overflow-y-auto rounded-lg text-left">
            {cacheData.length > 0 ? (
              [...cacheData].reverse().map((item, index) => (
                <div
                  key={index}
                  onClick={() => {
                    loadFromCache(item.url);
                    setIsCacheVisible(false);
                  }}
                  className="cursor-pointer rounded-lg shadow-sm transition-all text-left p-3 mb-2 bg-white border border-[#667eea]/10 hover:bg-[#667eea]/5 hover:border-[#667eea]/30 hover:translate-x-1"
                >
                  <div className="text-xs text-gray-500 mb-1">{item.timestamp}</div>
                  <div className="text-sm truncate">{item.fileName}</div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-4">还没有记录哦！</div>
            )}
          </div>
        )}
      </div>

      <p className="text-sm text-center mt-5 mb-0 text-[#999] leading-relaxed">
        项目开源于 GitHub - <a href="https://github.com/0-RTT/telegraph" target="_blank" rel="noopener noreferrer" className="text-[#667eea] no-underline hover:text-[#764ba2] hover:underline transition-colors">0-RTT/telegraph</a>
      </p>
    </div>
  );
}
