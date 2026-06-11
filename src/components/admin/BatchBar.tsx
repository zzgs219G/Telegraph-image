import React, { useState } from 'react';
import type { Tag } from '@/types';

export interface BatchBarProps {
  selectedCount: number;
  onClearSelect: () => void;
  onDelete: () => void;
  onBatchTag: (tagId: number | null) => void;
  onCopyLinks: (format: 'url' | 'bbcode' | 'markdown') => void;
  tags: Tag[];
}

const BatchBar: React.FC<BatchBarProps> = ({
  selectedCount, onClearSelect, onDelete, onBatchTag, onCopyLinks, tags
}) => {
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-auto z-40 bg-slate-900 text-white rounded-2xl shadow-2xl px-4 md:px-6 py-3 md:py-4 flex flex-wrap items-center justify-between md:justify-start gap-3 md:gap-6 animate-in slide-in-from-bottom-10 fade-in duration-300">
      <div className="flex items-center space-x-3 md:border-r md:border-slate-700 md:pr-6 shrink-0">
        <div className="bg-indigo-500 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
          {selectedCount}
        </div>
        <span className="font-medium text-sm">已选择</span>
        <button
          onClick={onClearSelect}
          className="text-slate-400 hover:text-white text-sm underline decoration-slate-500 underline-offset-4 ml-2"
        >
          取消
        </button>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative">
          <button
            onClick={() => { setShowTagMenu(!showTagMenu); setShowCopyMenu(false); }}
            className="flex items-center space-x-1.5 hover:text-indigo-300 transition-colors py-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
            <span className="text-sm font-medium">打标签</span>
          </button>

          {showTagMenu && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-white text-slate-800 rounded-lg shadow-xl overflow-hidden py-1 border border-slate-200">
              <div className="px-3 py-2 text-xs font-semibold text-slate-400 border-b border-slate-100">选择标签</div>
              <button
                onClick={() => { onBatchTag(null); setShowTagMenu(false); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-slate-500"
              >
                (清除标签)
              </button>
              {tags.map(t => (
                <button
                  key={t.id}
                  onClick={() => { onBatchTag(t.id); setShowTagMenu(false); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center space-x-2"
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }}></span>
                  <span>{t.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => { setShowCopyMenu(!showCopyMenu); setShowTagMenu(false); }}
            className="flex items-center space-x-1.5 hover:text-indigo-300 transition-colors py-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span className="text-sm font-medium">复制链接</span>
          </button>

          {showCopyMenu && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-36 bg-white text-slate-800 rounded-lg shadow-xl overflow-hidden py-1 border border-slate-200">
              <button onClick={() => { onCopyLinks('url'); setShowCopyMenu(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50">URL</button>
              <button onClick={() => { onCopyLinks('bbcode'); setShowCopyMenu(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50">BBCode</button>
              <button onClick={() => { onCopyLinks('markdown'); setShowCopyMenu(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50">Markdown</button>
            </div>
          )}
        </div>

        <button
          onClick={onDelete}
          className="flex items-center space-x-1.5 text-red-400 hover:text-red-300 transition-colors py-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          <span className="text-sm font-medium">删除</span>
        </button>
      </div>
    </div>
  );
};

export default BatchBar;
