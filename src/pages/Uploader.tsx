import React, { useState, useEffect, useRef } from 'react';
import { uploadFile } from '../services/api';
import type { CachedUpload } from '../types';
import { Clock, Link as LinkIcon, Code, Type, Trash2, Minimize2, Maximize2, UploadCloud, ChevronLeft, Check, Copy } from 'lucide-react';
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
  return `${hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('')}-${file.size}-${file.lastModified}`;
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
        resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file);
      }, 'image/jpeg', quality);
    };
    const reader = new FileReader();
    reader.onload = (e) => { if (e.target?.result) image.src = e.target.result as string; };
    reader.readAsDataURL(file);
  });
};

// ── URL Result Row ───────────────────────────────────────────────────────────
const UrlRow: React.FC<{ url: string; index: number; onRemove: () => void }> = ({ url, index, onRemove }) => {
  const [copied, setCopied] = useState(false);
  const short = url.replace(/^https?:\/\//, '');

  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <div className="group flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/8 rounded-xl px-3.5 py-2.5 transition-all duration-200">
      <span className="text-[10px] font-mono text-slate-500 w-4 text-center shrink-0">{index + 1}</span>
      <span className="flex-1 text-xs font-mono text-slate-300 truncate select-all">{short}</span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={copy}
          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          title="复制链接"
        >
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
          title="移除"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};

// ── Thumbnail Grid ───────────────────────────────────────────────────────────
const ThumbnailGrid: React.FC<{
  thumbnails: { url: string; preview: string; type: string }[];
  onRemove: (i: number) => void;
}> = ({ thumbnails, onRemove }) => (
  <div className="grid grid-cols-4 gap-2">
    {thumbnails.map((t, idx) => (
      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group border border-white/10 bg-white/5">
        {t.type.startsWith('image/') ? (
          <img src={t.preview} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="" />
        ) : t.type.startsWith('video/') ? (
          <video src={t.preview} className="w-full h-full object-cover" muted />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-500 font-mono text-[10px] font-semibold tracking-widest">FILE</div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center">
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(idx); }}
            className="p-1.5 rounded-lg bg-black/70 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all duration-150 scale-90 group-hover:scale-100"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    ))}
  </div>
);

// ── Main Component ───────────────────────────────────────────────────────────
const UploaderPage: React.FC<UploaderProps> = ({ adminMode, token, onUploadSuccess }) => {
  const [urls, setUrls] = useState<string[]>([]);
  const [thumbnails, setThumbnails] = useState<{ url: string; preview: string; type: string }[]>([]);
  const [progress, setProgress] = useState<{ [key: string]: number }>({});
  const [isCompressing, setIsCompressing] = useState(true);
  const [showCache, setShowCache] = useState(false);
  const [cache, setCache] = useState<CachedUpload[]>(() => {
    try { return JSON.parse(localStorage.getItem('uploadCache') || '[]'); } catch { return []; }
  });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: File[]) => {
    for (const file of files) {
      const fileHash = await calculateHash(file);
      const existing = cache.find(c => c.hash === fileHash);
      if (existing && !adminMode) {
        if (!urls.includes(existing.url)) setUrls(prev => [...prev, existing.url]);
        continue;
      }
      const tempId = Math.random().toString(36).substring(7);
      setProgress(prev => ({ ...prev, [tempId]: 0 }));
      try {
        let uploadable = file;
        if (file.type.startsWith('image/') && file.type !== 'image/gif' && isCompressing) {
          uploadable = await compressImage(file);
        }
        const res = await uploadFile(uploadable, (p) => {
          setProgress(prev => ({ ...prev, [tempId]: p }));
        }, adminMode, token);
        if (res.data) {
          setUrls(prev => [...prev, res.data!]);
          onUploadSuccess?.(res.data!);
          if (!adminMode) {
            const preview = URL.createObjectURL(file);
            setThumbnails(prev => [...prev, { url: res.data!, preview, type: file.type }]);
            const item: CachedUpload = {
              url: res.data!,
              fileName: file.name,
              hash: fileHash,
              timestamp: new Date().toLocaleString('zh-CN', { hour12: false })
            };
            const next = [...cache, item];
            setCache(next);
            localStorage.setItem('uploadCache', JSON.stringify(next));
          }
        } else if (res.error) {
          toast.error(`上传失败: ${res.error}`);
        }
      } catch {
        toast.error('上传过程中发生错误');
      } finally {
        setProgress(prev => { const n = { ...prev }; delete n[tempId]; return n; });
      }
    }
  };

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (e.clipboardData?.items) {
        for (const item of Array.from(e.clipboardData.items)) {
          if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file) { handleFiles([file]); break; }
          }
        }
      }
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  }, [isCompressing, cache, urls]);

  const handleCopyAll = (format: 'url' | 'bbcode' | 'markdown') => {
    if (urls.length === 0) return;
    const text =
      format === 'url' ? urls.join('\n\n') :
      format === 'bbcode' ? urls.map(u => `[img]${u}[/img]`).join('\n\n') :
      urls.map(u => `![image](${u})`).join('\n\n');
    navigator.clipboard.writeText(text)
      .then(() => toast.success('已全部复制'))
      .catch(() => toast.error('复制失败'));
  };

  const removeThumbnail = (idx: number) => {
    URL.revokeObjectURL(thumbnails[idx].preview);
    const url = thumbnails[idx].url;
    setThumbnails(prev => prev.filter((_, i) => i !== idx));
    setUrls(prev => prev.filter(u => u !== url));
  };

  const removeUrl = (idx: number) => {
    const url = urls[idx];
    const tIdx = thumbnails.findIndex(t => t.url === url);
    if (tIdx !== -1) {
      URL.revokeObjectURL(thumbnails[tIdx].preview);
      setThumbnails(prev => prev.filter((_, i) => i !== tIdx));
    }
    setUrls(prev => prev.filter((_, i) => i !== idx));
  };

  const activeProgress = Object.values(progress);
  const hasResults = urls.length > 0;
  const isUploading = activeProgress.length > 0;

  return (
    <div className="flex items-center justify-center min-h-screen p-6 font-sans">
      {/* Card */}
      <div className="relative w-full max-w-md">

        {/* Ambient glow */}
        <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-white/10 via-transparent to-white/5 pointer-events-none" />

        <div className="relative bg-slate-950/60 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.5)] overflow-hidden">

          {/* Top bar */}
          <div className="flex items-center justify-between px-6 pt-6 pb-0">
            <div>
              {showCache ? (
                <button
                  onClick={() => setShowCache(false)}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors mb-1"
                >
                  <ChevronLeft size={14} />
                  <span>返回上传</span>
                </button>
              ) : (
                <>
                  <h1 className="text-lg font-semibold text-white tracking-tight leading-none">
                    Telegraph <span className="text-slate-500 font-light">Cloud</span>
                  </h1>
                  <p className="text-[11px] text-slate-500 mt-1">轻量图床 · 基于 Telegram 存储</p>
                </>
              )}
            </div>

            <div className="flex gap-1">
              {!showCache && (
                <button
                  onClick={() => setIsCompressing(!isCompressing)}
                  className={`p-2 rounded-xl text-xs transition-all duration-200 ${
                    isCompressing
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                      : 'text-slate-500 hover:text-slate-300 border border-transparent'
                  }`}
                  title={isCompressing ? '智能压缩已开启' : '点击开启压缩'}
                >
                  {isCompressing ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
              )}
              <button
                onClick={() => setShowCache(!showCache)}
                className={`p-2 rounded-xl relative transition-all duration-200 ${
                  showCache
                    ? 'bg-white/10 text-white border border-white/10'
                    : 'text-slate-500 hover:text-slate-300 border border-transparent'
                }`}
                title="上传历史"
              >
                <Clock size={15} />
                {cache.length > 0 && !showCache && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                )}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-6 mt-4 mb-0 h-px bg-white/5" />

          {/* Body */}
          <div className="p-6 space-y-4">

            {showCache ? (
              /* ── History ── */
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-slate-500">共 {cache.length} 条记录</span>
                  {cache.length > 0 && (
                    <button
                      onClick={() => {
                        setCache([]);
                        localStorage.removeItem('uploadCache');
                      }}
                      className="text-xs text-slate-600 hover:text-red-400 transition-colors"
                    >
                      清空
                    </button>
                  )}
                </div>
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5 -mr-1">
                  {cache.length === 0 ? (
                    <div className="py-12 text-center">
                      <Clock size={24} className="mx-auto mb-3 text-slate-700" />
                      <p className="text-sm text-slate-600">暂无历史记录</p>
                    </div>
                  ) : (
                    [...cache].reverse().map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setUrls([item.url]); setShowCache(false); }}
                        className="w-full text-left group flex items-start gap-3 bg-white/3 hover:bg-white/8 border border-white/5 hover:border-white/10 rounded-xl px-3.5 py-2.5 transition-all duration-150"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-200 font-medium truncate group-hover:text-white transition-colors">{item.fileName}</p>
                          <p className="text-[10px] font-mono text-slate-500 truncate mt-0.5">{item.url}</p>
                        </div>
                        <span className="text-[10px] text-slate-600 font-mono shrink-0 mt-0.5">{item.timestamp.split(' ')[0]}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              /* ── Upload ── */
              <>
                {/* Drop zone */}
                <div
                  className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden ${
                    isDragging
                      ? 'border-white/50 bg-white/8 scale-[0.99]'
                      : isUploading
                        ? 'border-indigo-500/40 bg-indigo-500/5'
                        : 'border-white/12 bg-white/3 hover:border-white/25 hover:bg-white/6'
                  }`}
                  style={{ minHeight: hasResults ? 100 : 160 }}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files.length > 0) handleFiles(Array.from(e.dataTransfer.files));
                  }}
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

                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6">
                    {isUploading ? (
                      <div className="w-full space-y-2.5">
                        {activeProgress.map((p, i) => (
                          <div key={i} className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-mono text-slate-400">
                              <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                                正在上传...
                              </span>
                              <span>{p}%</span>
                            </div>
                            <div className="h-0.5 w-full bg-white/8 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-violet-400 transition-all duration-300 rounded-full"
                                style={{ width: `${p}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <UploadCloud
                          size={hasResults ? 28 : 36}
                          className={`transition-all duration-300 ${isDragging ? 'text-white scale-110' : 'text-slate-500 group-hover:text-slate-400'}`}
                        />
                        <div className="text-center">
                          <p className="text-sm text-slate-300">
                            拖拽文件至此，或{' '}
                            <span className="text-white underline underline-offset-4 decoration-white/30">点击选择</span>
                          </p>
                          {!hasResults && (
                            <p className="text-[11px] text-slate-600 mt-1">支持多文件 · 页面任意位置 Ctrl+V 粘贴</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Thumbnails */}
                {thumbnails.length > 0 && (
                  <ThumbnailGrid thumbnails={thumbnails} onRemove={removeThumbnail} />
                )}

                {/* Results */}
                {hasResults && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-bottom-1 duration-200">
                    {/* Action strip */}
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] text-slate-500 mr-auto">
                        {urls.length} 个链接
                      </span>
                      <button
                        onClick={() => handleCopyAll('url')}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/6 hover:bg-white/12 text-slate-400 hover:text-white text-[11px] transition-all border border-white/6 hover:border-white/12"
                      >
                        <LinkIcon size={11} /> URL
                      </button>
                      <button
                        onClick={() => handleCopyAll('bbcode')}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/6 hover:bg-white/12 text-slate-400 hover:text-white text-[11px] transition-all border border-white/6 hover:border-white/12"
                      >
                        <Code size={11} /> BB
                      </button>
                      <button
                        onClick={() => handleCopyAll('markdown')}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/6 hover:bg-white/12 text-slate-400 hover:text-white text-[11px] transition-all border border-white/6 hover:border-white/12"
                      >
                        <Type size={11} /> MD
                      </button>
                    </div>

                    {/* URL list */}
                    <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5 -mr-1">
                      {urls.map((url, i) => (
                        <UrlRow key={url} url={url} index={i} onRemove={() => removeUrl(i)} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-5 flex items-center justify-between">
            <a
              href="https://github.com/0-RTT/telegraph"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
            >
              GitHub
            </a>
            {isCompressing && !showCache && (
              <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                <span className="w-1 h-1 bg-emerald-500 rounded-full" />
                智能压缩已开启
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploaderPage;
