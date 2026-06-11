import React, { useRef, useState } from 'react';
import type { Tag } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface ToolbarProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  onUploadSuccess: (url: string) => void;
  token: string;
  activeTag: Tag | undefined;
  onTriggerBingCrawl: () => void;
  isCrawlingBing: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({
  searchTerm, setSearchTerm,
  viewMode, setViewMode,
  onUploadSuccess, token,
  activeTag, onTriggerBingCrawl, isCrawlingBing
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    setIsUploading(true);
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('/api/admin/upload', {
          method: 'POST',
          headers: { Authorization: `Basic ${token}` },
          body: formData,
        });
        const data = await res.json() as { data?: string; error?: string };
        if (data.data) {
          onUploadSuccess(data.data);
        } else {
          alert(`上传失败: ${data.error}`);
        }
      } catch {
        alert('上传过程中发生错误');
      }
    }
    setIsUploading(false);
    e.target.value = '';
  };

  return (
    <div className="bg-white p-3 md:p-4 border-b border-slate-200 flex flex-col gap-3 shrink-0">
      {/* 搜索框 */}
      <div className="relative w-full">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd" />
          </svg>
        </div>
        <Input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
          placeholder="搜索文件名或 URL..."
        />
      </div>

      {/* 操作按钮行 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        {activeTag?.name === '必应壁纸' && (
          <Button
            variant="outline"
            size="sm"
            onClick={onTriggerBingCrawl}
            disabled={isCrawlingBing}
            className="text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
            {isCrawlingBing ? '抓取中...' : '抓取今日壁纸'}
          </Button>
        )}

        {/* 视图切换 */}
        <div className="flex bg-slate-100 rounded-lg p-1 shrink-0">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'grid'
                ? 'bg-white shadow-sm text-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'list'
                ? 'bg-white shadow-sm text-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </button>
        </div>

        {/* 上传按钮 */}
        <input
          type="file"
          multiple
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          {isUploading ? '上传中...' : '上传文件'}
        </Button>
      </div>
    </div>
  );
};

export default Toolbar;