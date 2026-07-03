import React, { useState, useEffect, useRef } from 'react';
import { uploadFile } from '../services/api';
import type { CachedUpload } from '../types';
import {
  Clock, Link as LinkIcon, Code, Type, Trash2,
  Zap, ZapOff, UploadCloud, ChevronLeft, Check, Copy, FileImage
} from 'lucide-react';
import { toast } from 'sonner';

export interface UploaderProps {
  adminMode?: boolean;
  token?: string;
  onUploadSuccess?: (url: string) => void;
}

const calculateHash = async (file: File): Promise<string> => {
  if (!window.crypto?.subtle) return `fallback-${file.name}-${file.size}-${file.lastModified}`;
  const chunkSize = 1024 * 1024;
  const chunk = file.size > chunkSize ? file.slice(0, chunkSize) : file;
  const buf = await crypto.subtle.digest('SHA-256', await chunk.arrayBuffer());
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('') + `-${file.size}-${file.lastModified}`;
};

const convertImage = (file: File, targetType: 'image/webp' | 'image/jpeg', quality = 0.82): Promise<File> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(file);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return resolve(file);
        const ext = targetType === 'image/webp' ? 'webp' : 'jpg';
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '') + '.' + ext, { type: targetType }));
      }, targetType, quality);
    };
    const reader = new FileReader();
    reader.onload = (e) => { if (e.target?.result) img.src = e.target.result as string; };
    reader.readAsDataURL(file);
  });

const makeThumbnailDataUrl = (file: File): Promise<string> =>
  new Promise((resolve) => {
    if (!file.type.startsWith('image/')) return resolve('');
    const img = new Image();
    img.onload = () => {
      const MAX = 96, ratio = Math.min(MAX / img.width, MAX / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * ratio); canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve('');
    const reader = new FileReader();
    reader.onload = (e) => { if (e.target?.result) img.src = e.target.result as string; };
    reader.readAsDataURL(file);
  });

const UrlRow: React.FC<{ url: string; index: number; onRemove: () => void }> = ({ url, index, onRemove }) => {
  const [copied, setCopied] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); });
  };
  return (
    <div className="group flex items-center gap-2.5 bg-white/5 hover:bg-white/9 border border-white/8 rounded-xl px-3 py-2 transition-all duration-150">
      <span className="text-[10px] font-mono text-slate-600 w-4 text-center shrink-0">{index + 1}</span>
      <div className="flex-1 overflow-x-auto min-w-0" style={{ scrollbarWidth: 'none' }}>
        <span className="block text-xs font-mono text-slate-300 whitespace-nowrap cursor-text select-all">{url}</span>
      </div>
      <div className="flex items-center gap-0.5 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button onClick={copy} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors" title="复制完整链接">
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
        </button>
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-600 hover:text-red-400 transition-colors">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};

const ThumbnailGrid: React.FC<{ items: { url: string; preview: string; type: string }[]; onRemove: (i: number) => void }> = ({ items, onRemove }) => (
  <div className="grid grid-cols-4 gap-2">
    {items.map((t, idx) => (
      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group border border-white/10 bg-white/5">
        {t.type.startsWith('image/') ? (
          <img src={t.preview} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="" />
        ) : t.type.startsWith('video/') ? (
          <video src={t.preview} className="w-full h-full object-cover" muted />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-500 text-[10px] font-mono font-semibold">FILE</div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/45 transition-colors flex items-center justify-center">
          <button onClick={(e) => { e.stopPropagation(); onRemove(idx); }} className="p-1.5 rounded-lg bg-black/70 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all scale-90 group-hover:scale-100">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    ))}
  </div>
);

const CacheRow: React.FC<{ item: CachedUpload; onSelect: () => void }> = ({ item, onSelect }) => {
  const [copied, setCopied] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };
  return (
    <div onClick={onSelect} className="group flex items-center gap-3 bg-white/3 hover:bg-white/8 border border-white/5 hover:border-white/10 rounded-xl p-2.5 cursor-pointer transition-all duration-150">
      <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-white/5 border border-white/8 flex items-center justify-center">
        {item.previewDataUrl
          ? <img src={item.previewDataUrl} alt="" className="w-full h-full object-cover" />
          : <FileImage size={16} className="text-slate-600" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-200 font-medium truncate group-hover:text-white transition-colors">{item.fileName}</p>
        <div className="overflow-x-auto mt-0.5" style={{ scrollbarWidth: 'none' }}>
          <p className="text-[10px] font-mono text-slate-500 whitespace-nowrap">{item.url}</p>
        </div>
        <p className="text-[9px] text-slate-600 mt-0.5">{item.timestamp}</p>
      </div>
      <button onClick={copy} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 text-slate-400 hover:text-white transition-all shrink-0">
        {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
      </button>
    </div>
  );
};

type ConvertMode = 'none' | 'webp';

const UploaderPage: React.FC<UploaderProps> = ({ adminMode, token, onUploadSuccess }) => {
  const [urls, setUrls] = useState<string[]>([]);
  const [thumbnails, setThumbnails] = useState<{ url: string; preview: string; type: string }[]>([]);
  const [progress, setProgress] = useState<{ [key: string]: number }>({});
  const [isCompressing, setIsCompressing] = useState(true);
  const [convertMode, setConvertMode] = useState<ConvertMode>('none');
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
        const isImage = file.type.startsWith('image/');
        const isGif = file.type === 'image/gif';
        if (isImage && !isGif) {
          if (convertMode === 'webp') {
            uploadable = await convertImage(file, 'image/webp', isCompressing ? 0.82 : 0.92);
          } else if (isCompressing) {
            uploadable = await convertImage(file, 'image/jpeg', 0.75);
          }
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
            const previewDataUrl = await makeThumbnailDataUrl(file);
            const item: CachedUpload = {
              url: res.data!,
              fileName: uploadable.name,
              hash: fileHash,
              timestamp: new Date().toLocaleString('zh-CN', { hour12: false }),
              previewDataUrl,
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
          if (item.kind === 'file') { const f = item.getAsFile(); if (f) { handleFiles([f]); break; } }
        }
      }
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  }, [isCompressing, convertMode, cache, urls]);

  const handleCopyAll = (format: 'url' | 'bbcode' | 'markdown') => {
    if (!urls.length) return;
    const text = format === 'url' ? urls.join('\n\n')
      : format === 'bbcode' ? urls.map(u => `[img]${u}[/img]`).join('\n\n')
      : urls.map(u => `![image](${u})`).join('\n\n');
    navigator.clipboard.writeText(text).then(() => toast.success('已全部复制')).catch(() => toast.error('复制失败'));
  };

  const removeThumbnail = (idx: number) => {
    URL.revokeObjectURL(thumbnails[idx].preview);
    const urlToRemove = thumbnails[idx].url;
    setThumbnails(prev => prev.filter((_, i) => i !== idx));
    setUrls(prev => prev.filter(u => u !== urlToRemove));
  };

  const removeUrl = (idx: number) => {
    const urlToRemove = urls[idx];
    const tIdx = thumbnails.findIndex(t => t.url === urlToRemove);
    if (tIdx !== -1) { URL.revokeObjectURL(thumbnails[tIdx].preview); setThumbnails(prev => prev.filter((_, i) => i !== tIdx)); }
    setUrls(prev => prev.filter((_, i) => i !== idx));
  };

  const activeProgress = Object.values(progress);
  const hasResults = urls.length > 0;
  const isUploading = activeProgress.length > 0;

  return (
    <div className="flex items-center justify-center min-h-screen p-6 font-sans">
      <div className="relative w-full max-w-md">
        <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-white/10 via-transparent to-white/5 pointer-events-none" />
        <div className="relative bg-slate-950/60 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.5)] overflow-hidden">

          {/* Top bar */}
          <div className="flex items-center justify-between px-6 pt-6 pb-0">
            <div>
              {showCache ? (
                <button onClick={() => setShowCache(false)} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors">
                  <ChevronLeft size={14} /><span>返回上传</span>
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

            {!showCache && (
              <div className="flex items-center gap-1">
                {/* WebP */}
                <button
                  onClick={() => setConvertMode(m => m === 'webp' ? 'none' : 'webp')}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-[10px] font-medium transition-all border ${convertMode === 'webp' ? 'bg-violet-500/15 text-violet-300 border-violet-500/25' : 'text-slate-500 hover:text-slate-300 border-transparent hover:border-white/10'}`}
                  title={convertMode === 'webp' ? '关闭 WebP 转换' : '上传前转为 WebP'}
                >
                  <FileImage size={13} /><span>WebP</span>
                </button>
                {/* Compress */}
                <button
                  onClick={() => setIsCompressing(c => !c)}
                  className={`p-2 rounded-xl transition-all border ${isCompressing ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'text-slate-500 hover:text-slate-300 border-transparent hover:border-white/10'}`}
                  title={isCompressing ? '智能压缩已开启（点击关闭）' : '智能压缩已关闭（点击开启）'}
                >
                  {isCompressing ? <Zap size={14} /> : <ZapOff size={14} />}
                </button>
                {/* History */}
                <button
                  onClick={() => setShowCache(true)}
                  className="p-2 rounded-xl relative text-slate-500 hover:text-slate-300 border border-transparent hover:border-white/10 transition-all"
                  title="上传历史"
                >
                  <Clock size={14} />
                  {cache.length > 0 && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-400 rounded-full" />}
                </button>
              </div>
            )}
          </div>

          <div className="mx-6 mt-4 h-px bg-white/5" />

          {/* Body */}
          <div className="p-6 space-y-4">
            {showCache ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-slate-500">共 {cache.length} 条记录</span>
                  {cache.length > 0 && (
                    <button onClick={() => { setCache([]); localStorage.removeItem('uploadCache'); }} className="text-[11px] text-slate-600 hover:text-red-400 transition-colors">
                      清空全部
                    </button>
                  )}
                </div>
                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                  {cache.length === 0 ? (
                    <div className="py-14 text-center">
                      <Clock size={22} className="mx-auto mb-3 text-slate-700" />
                      <p className="text-sm text-slate-600">暂无历史记录</p>
                    </div>
                  ) : (
                    [...cache].reverse().map((item, idx) => (
                      <CacheRow key={idx} item={item} onSelect={() => { setUrls([item.url]); setShowCache(false); }} />
                    ))
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Drop zone */}
                <div
                  className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden ${isDragging ? 'border-white/50 bg-white/8 scale-[0.99]' : isUploading ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-white/12 bg-white/3 hover:border-white/25 hover:bg-white/6'}`}
                  style={{ minHeight: hasResults ? 96 : 156 }}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length) handleFiles(Array.from(e.dataTransfer.files)); }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input type="file" multiple ref={fileInputRef} className="hidden"
                  accept="image/*,video/*"
                    onChange={(e) => { if (e.target.files) handleFiles(Array.from(e.target.files)); e.target.value = ''; }}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6">
                    {isUploading ? (
                      <div className="w-full space-y-2.5">
                        {activeProgress.map((p, i) => (
                          <div key={i} className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-mono text-slate-400">
                              <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                                {convertMode === 'webp' ? '转换并上传...' : '正在上传...'}
                              </span>
                              <span>{p}%</span>
                            </div>
                            <div className="h-0.5 w-full bg-white/8 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-400 transition-all duration-300 rounded-full" style={{ width: `${p}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <UploadCloud size={hasResults ? 26 : 34} className={`transition-all duration-300 ${isDragging ? 'text-white scale-110' : 'text-slate-500'}`} />
                        <div className="text-center">
                          <p className="text-sm text-slate-300">拖拽文件至此，或 <span className="text-white underline underline-offset-4 decoration-white/30">点击选择</span></p>
                          {!hasResults && <p className="text-[11px] text-slate-600 mt-1">支持多文件 · 任意位置 Ctrl+V 粘贴</p>}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Active badges */}
                {(isCompressing || convertMode === 'webp') && (
                  <div className="flex gap-1.5 flex-wrap">
                    {convertMode === 'webp' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-[10px] text-violet-300">
                        <FileImage size={10} /> 转换为 WebP
                      </span>
                    )}
                    {isCompressing && convertMode !== 'webp' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-300">
                        <Zap size={10} /> 智能压缩
                      </span>
                    )}
                    {isCompressing && convertMode === 'webp' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-300">
                        <Zap size={10} /> 高质量 WebP 压缩
                      </span>
                    )}
                  </div>
                )}

                {/* Thumbnails */}
                {thumbnails.length > 0 && <ThumbnailGrid items={thumbnails} onRemove={removeThumbnail} />}

                {/* Results */}
                {hasResults && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-bottom-1 duration-200">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 mr-auto">{urls.length} 个链接</span>
                      {(['url', 'bbcode', 'markdown'] as const).map((f) => (
                        <button key={f} onClick={() => handleCopyAll(f)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/6 hover:bg-white/12 text-slate-400 hover:text-white text-[10px] transition-all border border-white/6 hover:border-white/12">
                          {f === 'url' ? <><LinkIcon size={10} /> URL</> : f === 'bbcode' ? <><Code size={10} /> BB</> : <><Type size={10} /> MD</>}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {urls.map((url, i) => <UrlRow key={url} url={url} index={i} onRemove={() => removeUrl(i)} />)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-5">
            <a href="https://github.com/0-RTT/telegraph" target="_blank" rel="noreferrer" className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors">GitHub</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploaderPage;
