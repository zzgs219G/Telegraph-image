import React, { useState, useEffect, useRef } from 'react';
import { uploadFile } from '../services/api';
import type { CachedUpload } from '../types';
import { Clock, Info, Link as LinkIcon, Code, Type, Trash2, Minimize2, Maximize2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';

export interface UploaderProps {
  adminMode?: boolean;
  token?: string;
  onUploadSuccess?: (url: string) => void;
}


const calculateHash = async (file: File) => {
  if (!window.crypto || !window.crypto.subtle) {
    return `fallback-${file.name}-${file.size}-${file.lastModified}`;
  }
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

const UploaderPage: React.FC<UploaderProps> = ({ adminMode, token, onUploadSuccess }) => {
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
      if (existingCache && !adminMode) {
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
        }, adminMode, token);
        if (res.data) {
          const newUrl = res.data;
          setUrls(prev => [...prev, newUrl]);
          if (onUploadSuccess) {
            onUploadSuccess(newUrl);
          }
          if (!adminMode) {
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
          }
        } else if (res.error) {
          toast.error(`上传失败: ${res.error}`);
        }
      } catch {
        toast.error('上传过程中发生错误');
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
  }, [isCompressing, cache, urls]);

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
    if (format === 'url') text = urls.join('\n\n');
    else if (format === 'bbcode') text = urls.map(u => `[img]${u}[/img]`).join('\n\n');
    else if (format === 'markdown') text = urls.map(u => `![image](${u})`).join('\n\n');
    navigator.clipboard.writeText(text).then(() => {
      toast.success('复制成功');
    }).catch(() => {
      toast.error('复制失败');
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
    <div className="flex items-center justify-center min-h-screen p-6 font-sans">
      <div className="relative bg-slate-900/40 backdrop-blur-2xl rounded-3xl shadow-[0_32px_64px_rgba(0,0,0,0.2)] border border-white/10 p-8 w-full max-w-xl mx-auto transition-all duration-300">
        
        {/* Header Section */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Telegraph <span className="text-slate-400 font-light">Cloud</span>
            </h1>
            <p className="text-xs text-slate-400/80 mt-1">简单、纯粹的轻量级图床系统</p>
          </div>
          <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setIsCompressing(!isCompressing)}
              className={`p-2 rounded-lg transition-all duration-200 ${isCompressing ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
              title={isCompressing ? "已开启智能压缩" : "未开启压缩"}
            >
              {isCompressing ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button
              onClick={() => setShowCache(!showCache)}
              className={`p-2 rounded-lg transition-all duration-200 ${showCache ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
              title="上传历史记录"
            >
              <Clock size={18} />
            </button>
          </div>
        </div>

        {showCache ? (
          /* History View */
          <div className="space-y-2">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-medium text-slate-400">历史记录 ({cache.length})</span>
              <button onClick={() => setShowCache(false)} className="text-xs text-white/60 hover:text-white transition-colors">返回上传</button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {cache.length === 0 ? (
                <p className="text-center text-sm text-slate-500 py-8">暂无历史上传记录</p>
              ) : (
                [...cache].reverse().map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl p-3 cursor-pointer transition-all text-left group"
                    onClick={() => {
                      setUrls([item.url]);
                      setShowCache(false);
                    }}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <div className="font-medium text-sm text-slate-200 truncate max-w-[70%]">{item.fileName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{item.timestamp}</div>
                    </div>
                    <div className="text-xs text-slate-400 truncate font-mono group-hover:text-slate-300">{item.url}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          /* Main Upload View */
          <>
            <div
              className={`border border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 group relative overflow-hidden ${
                isDragging 
                  ? 'border-white bg-white/10 scale-[0.99]' 
                  : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/8'
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
              <div className="relative z-10">
                <UploadCloud className="mx-auto text-slate-400 group-hover:text-white transition-colors mb-4 duration-300" size={40} />
                <p className="text-sm font-medium text-slate-200">将文件拖拽至此处，或 <span className="text-white underline underline-offset-4 decoration-white/30 hover:decoration-white">点击浏览</span></p>
                <p className="text-xs text-slate-400/60 mt-2">支持多文件上传，可在页面任意位置直接 Ctrl+V 粘贴</p>
              </div>
            </div>

            {/* Progress Bars */}
            {activeProgress.length > 0 && (
              <div className="mt-4 space-y-2 bg-white/5 rounded-xl p-3 border border-white/5">
                {activeProgress.map((p, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-300 font-mono">
                      <span>正在上传资源...</span>
                      <span>{p}%</span>
                    </div>
                    <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                      <div className="bg-white h-full transition-all duration-300" style={{ width: `${p}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Thumbnails */}
            {thumbnails.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-6 justify-center">
                {thumbnails.map((t, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden shadow-lg group border border-white/10 bg-slate-950">
                    {t.type.startsWith('image/') ? (
                      <img src={t.preview} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" alt="preview" />
                    ) : t.type.startsWith('video/') ? (
                      <video src={t.preview} className="w-full h-full object-cover" muted />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 font-mono text-xs font-semibold">FILE</div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeThumbnail(idx); }}
                      className="absolute top-1 right-1 bg-black/70 text-white rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 duration-200"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Result Showcase */}
            {urls.length > 0 && (
              <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => handleCopy('url')} className="flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 text-white py-2 rounded-xl text-xs font-medium transition-all">
                    <LinkIcon size={14} /> URL
                  </button>
                  <button onClick={() => handleCopy('bbcode')} className="flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 text-white py-2 rounded-xl text-xs font-medium transition-all">
                    <Code size={14} /> BBCode
                  </button>
                  <button onClick={() => handleCopy('markdown')} className="flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 text-white py-2 rounded-xl text-xs font-medium transition-all">
                    <Type size={14} /> Markdown
                  </button>
                </div>
                <textarea
                  readOnly
                  value={urls.join('\n\n')}
                  className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-xs font-mono text-slate-300 focus:outline-none focus:border-white/30 resize-none h-28 custom-scrollbar"
                />
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-500/80 mt-8">
          Open Source via <a href="https://github.com/0-RTT/telegraph" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white hover:underline transition-colors">GitHub</a>
        </p>
      </div>
    </div>
  );
};

export default UploaderPage;