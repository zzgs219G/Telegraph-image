import React from 'react';
import type { Tag } from '@/types';

export interface SidebarProps {
  tags: Tag[];
  activeTagId: number | null;
  onSelectTag: (id: number | null) => void;
  onNewTag: () => void;
  onDeleteTag: (id: number) => void;
  isDeletingTag: number | null;
  totalCount: number;
}

const PRESET_TAGS = ['前台上传', '后台上传', '必应壁纸'];

const Sidebar: React.FC<SidebarProps> = ({ tags, activeTagId, onSelectTag, onNewTag, onDeleteTag, isDeletingTag, totalCount }) => {
  return (
    <div className="w-64 bg-white/80 backdrop-blur border-r border-slate-200 flex flex-col h-full overflow-hidden shrink-0">
      <div className="p-4 overflow-y-auto flex-1 space-y-1">
        <div
          onClick={() => onSelectTag(null)}
          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${
            activeTagId === null ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <span>全部媒体</span>
          <span className="bg-slate-100 text-slate-500 py-0.5 px-2 rounded-full text-xs">
            {totalCount}
          </span>
        </div>

        <div className="pt-4 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider px-2">标签分类</div>

        {tags.map(tag => (
          <div
            key={tag.id}
            onClick={() => onSelectTag(tag.id)}
            className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer ${
              activeTagId === tag.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }}></span>
              <span>{tag.name}</span>
            </div>

            <div className="flex items-center">
              <span className={`bg-slate-100 text-slate-500 py-0.5 px-2 rounded-full text-xs ${activeTagId === tag.id ? 'bg-indigo-100 text-indigo-600' : ''}`}>
                {tag.count || 0}
              </span>

              {!PRESET_TAGS.includes(tag.name) && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteTag(tag.id); }}
                  className="ml-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
                  disabled={isDeletingTag === tag.id}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-slate-200">
        <button
          onClick={onNewTag}
          className="w-full py-2 flex items-center justify-center space-x-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>
          <span>新建标签</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
