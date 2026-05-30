import React, { useState, useEffect, useRef } from 'react';
import { uploadFile } from '../services/api';
import type { CachedUpload } from '../types';
import { Clock, Info, Link as LinkIcon, Code, Type, Trash2, Minimize2, Maximize2, UploadCloud } from 'lucide-react';

const calculateHash = async (file: File) => {
  const chunkSize = 1024 * 1024;
  const chunk = file.size > chunkSize ? file.slice(0, chunkSize) : file;
  const arrayBuffer = await chunk.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hash}-${file.size}-${file.lastModified}`;
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
    reader.onload = (event) => {
      if (event.target?.result) {
        image.src = event.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  });
};

const UploaderPage: React.FC = () => {
  const [urls, setUrls] = useState<string[]>([]);
  const [thumbnails, setThumbnails] = useState<{ url: string, preview: string, type: string }[]>([]);
  const [progress, setProgress] = useState<{ [key: string]: number }>({});
  const [isCompressing, setIsCompressing] = useState(true);
  const [showCache, setShowCache] = useState(false);
  const [cache, setCache] = useState<CachedUpload[]>(() => {
    const localCache = localStorage.getItem('uploadCache');
    return localCache ? JSON.parse(localCache) : [];
  });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: File[]) => {
    for (const file of files) {
      const fileHash = await calculateHash(file);
      const existingCache = cache.find(c => c.hash === fileHash);

      if (existingCache) {
        if (!urls.includes(existingCache.url)) {
          setUrls(prev => [...prev, existingCache.url]);
        }
        continue;
      }

      const tempId = Math.random().toString(36).substring(7);
      setProgress(prev => ({ ...prev, [tempId]: 0 }));

      try {
        let uploadableFile = file;
        if (file.type.startsWith('image/') && file.type !== 'image/gif' && isCompressing) {
          uploadableFile = await compressImage(file);
        }

        const res = await uploadFile(uploadableFile, (p) => {
          setProgress(prev => ({ ...prev, [tempId]: p }));
        });

        if (res.data) {
          const newUrl = res.data;
          setUrls(prev => [...prev, newUrl]);

          const preview = URL.createObjectURL(file);
          setThumbnails(prev => [...prev, { url: newUrl, preview, type: file.type }]);

          const newCacheItem: CachedUpload = {
            url: newUrl,
            fileName: file.name,
            hash: fileHash,
            timestamp: new Date().toLocaleString('zh-CN', { hour12: false })
          };
          const newCache = [...cache, newCacheItem];
          setCache(newCache);
          localStorage.setItem('uploadCache', JSON.stringify(newCache));
        } else if (res.error) {
          alert(`上传失败: ${res.error}`);
        }
      } catch {
        alert('上传过程中发生错误');
      } finally {
        setProgress(prev => {
          const next = { ...prev };
          delete next[tempId];
          return next;
        });
      }
    }
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.items) {
        for (const item of Array.from(e.clipboardData.items)) {
          if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file) handleFiles([file]);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompressing, cache, urls]); // Include cache and urls to use the latest state inside handleFiles

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleCopy = (format: 'url' | 'bbcode' | 'markdown') => {
    if (urls.length === 0) return;

    let text = '';
    if (format === 'url') text = urls.join('\\n\\n');
    else if (format === 'bbcode') text = urls.map(u => `[img]${u}[/img]`).join('\\n\\n');
    else if (format === 'markdown') text = urls.map(u => `![image](${u})`).join('\\n\\n');

    navigator.clipboard.writeText(text).then(() => {
      alert('复制成功');
    }).catch(() => {
      alert('复制失败');
    });
  };

  const removeThumbnail = (index: number) => {
    const target = thumbnails[index];
    URL.revokeObjectURL(target.preview);
    setThumbnails(prev => prev.filter((_, i) => i !== index));
    setUrls(prev => prev.filter(u => u !== target.url));
  };

  const activeProgress = Object.values(progress);

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="relative bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl p-8 w-full max-w-lg mx-auto">

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            Telegraph图床
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setIsCompressing(!isCompressing)}
              className="p-2 text-indigo-400 hover:text-indigo-600 transition-colors"
              title={isCompressing ? "关闭压缩" : "开启压缩"}
            >
              {isCompressing ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
            </button>
            <button
              onClick={() => setShowCache(!showCache)}
              className="p-2 text-indigo-400 hover:text-indigo-600 transition-colors"
              title="查看历史记录"
            >
              <Clock size={24} />
            </button>
          </div>
        </div>

        {showCache ? (
          <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
            {cache.length === 0 ? (
              <p className="text-center text-gray-500 py-4">还没有记录哦！</p>
            ) : (
              [...cache].reverse().map((item, idx) => (
                <div
                  key={idx}
                  className="bg-white p-3 rounded-lg shadow-sm border border-indigo-50 cursor-pointer hover:bg-indigo-50/50 hover:border-indigo-200 transition-all text-sm text-left"
                  onClick={() => {
                    setUrls([item.url]);
                    setShowCache(false);
                  }}
                >
                  <div className="text-xs text-gray-400 mb-1">{item.timestamp}</div>
                  <div className="font-medium text-gray-700 truncate">{item.fileName}</div>
                </div>
              ))
            )}
          </div>
        ) : (
          <>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                isDragging ? 'border-purple-500 bg-purple-50' : 'border-indigo-300 bg-indigo-50/50 hover:border-purple-400 hover:bg-indigo-50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                multiple
                ref={fileInputRef}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleFiles(Array.from(e.target.files));
                  e.target.value = '';
                }}
              />
              <UploadCloud className="mx-auto text-indigo-500 mb-3" size={48} />
              <p className="text-indigo-600 font-medium">点击选择文件，或将文件拖拽到此处</p>
            </div>

            <div className="mt-4 flex items-center justify-center text-sm text-gray-500">
              <Info size={16} className="mr-1 text-indigo-500" />
              <span>支持拖拽上传 · 多文件上传 · Ctrl+V 粘贴上传</span>
            </div>

            {activeProgress.length > 0 && (
              <div className="mt-4 text-center">
                {activeProgress.map((p, i) => (
                  <div key={i} className="text-sm font-medium text-indigo-600 mb-1">
                    上传中... {p}%
                  </div>
                ))}
              </div>
            )}

            {thumbnails.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-6 justify-center">
                {thumbnails.map((t, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden shadow-md group">
                    {t.type.startsWith('image/') ? (
                      <img src={t.preview} className="w-full h-full object-cover" alt="thumbnail" />
                    ) : t.type.startsWith('video/') ? (
                      <video src={t.preview} className="w-full h-full object-cover" muted />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-xs">
                        FILE
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeThumbnail(idx); }}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {urls.length > 0 && (
              <div className="mt-6 space-y-4">
                <div className="flex gap-2 justify-center">
                  <button onClick={() => handleCopy('url')} className="flex-1 flex items-center justify-center gap-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 py-2 rounded-lg font-medium transition-colors text-sm">
                    <LinkIcon size={16} /> URL
                  </button>
                  <button onClick={() => handleCopy('bbcode')} className="flex-1 flex items-center justify-center gap-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 py-2 rounded-lg font-medium transition-colors text-sm">
                    <Code size={16} /> BBCode
                  </button>
                  <button onClick={() => handleCopy('markdown')} className="flex-1 flex items-center justify-center gap-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 py-2 rounded-lg font-medium transition-colors text-sm">
                    <Type size={16} /> Markdown
                  </button>
                </div>
                <textarea
                  readOnly
                  value={urls.join('\\n\\n')}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-32"
                />
              </div>
            )}
          </>
        )}

        <p className="text-center text-sm text-gray-400 mt-8">
          项目开源于 GitHub - <a href="https://github.com/0-RTT/telegraph" target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">0-RTT/telegraph</a>
        </p>
      </div>
    </div>
  );
};

export default UploaderPage;
