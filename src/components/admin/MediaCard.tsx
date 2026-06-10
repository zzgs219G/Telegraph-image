import React from 'react';
import type { MediaItem } from '../../types';

export interface MediaCardProps {
  item: MediaItem;
  isSelected: boolean;
  onToggleSelect: (url: string) => void;
  viewMode: 'grid' | 'list';
}

const MediaCard: React.FC<MediaCardProps> = ({ item, isSelected, onToggleSelect, viewMode }) => {
  const isVideo = item.url.match(/\\.(mp4|webm|mov|avi)$/i);
  const ext = item.url.split('.').pop()?.toUpperCase() || 'FILE';
  const sizeStr = item.size ? `${(item.size / 1024).toFixed(1)} KB` : '';
  const dateStr = item.created_at ? new Date(item.created_at * 1000).toLocaleDateString() : '';

  if (viewMode === 'list') {
    return (
      <div
        onClick={() => onToggleSelect(item.url)}
        className={`flex items-center p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/50' : ''}`}
      >
        <div className="flex-shrink-0 mr-4">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(item.url)}
            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        <div className="w-16 h-12 bg-slate-100 rounded overflow-hidden flex-shrink-0 flex items-center justify-center mr-4">
          {isVideo ? (
            <svg className="w-6 h-6 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
            </svg>
          ) : (
            <img src={item.url} alt="" className="w-full h-full object-cover" loading="lazy" />
          )}
        </div>

        <div className="flex-1 min-w-0 pr-4">
          <p className="text-sm font-medium text-slate-900 truncate" title={item.filename || item.url}>
            {item.filename || item.url.split('/').pop()}
          </p>
          <div className="flex items-center text-xs text-slate-500 mt-0.5 space-x-3">
            <span>{dateStr}</span>
            <span>{sizeStr}</span>
            <span className="font-mono truncate max-w-[200px]">{item.url}</span>
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center space-x-2">
          {item.tag && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: `${item.tag.color}20`, color: item.tag.color }}
            >
              {item.tag.name}
            </span>
          )}
          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-medium">
            {ext}
          </span>
        </div>
      </div>
    );
  }

  // Grid mode
  return (
    <div
      onClick={() => onToggleSelect(item.url)}
      className={`group relative bg-white rounded-xl shadow-sm border overflow-hidden cursor-pointer transition-all duration-200 ${
        isSelected ? 'ring-2 ring-indigo-500 border-indigo-500 scale-[0.98]' : 'border-slate-200 hover:shadow-md hover:border-slate-300'
      }`}
    >
      <div className="absolute top-2 left-2 z-10">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${
          isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white/80 border-slate-300 text-transparent opacity-0 group-hover:opacity-100 backdrop-blur-sm'
        }`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
      </div>

      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 items-end">
        <span className="bg-black/60 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm font-medium tracking-wide">
          {ext}
        </span>
        {item.tag && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded shadow-sm font-medium tracking-wide border"
            style={{
              backgroundColor: 'rgba(255,255,255,0.9)',
              color: item.tag.color,
              borderColor: `${item.tag.color}40`
            }}
          >
            {item.tag.name}
          </span>
        )}
      </div>

      <div className="aspect-square bg-slate-50 flex items-center justify-center relative overflow-hidden">
        {isVideo ? (
          <video src={item.url} className="w-full h-full object-cover" controls={isSelected} muted />
        ) : (
          <img src={item.url} alt={item.filename || "Media"} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        )}

        {/* Hover overlay with details */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end">
          <p className="text-white text-xs truncate font-medium mb-1" title={item.filename || item.url.split('/').pop()}>
            {item.filename || item.url.split('/').pop()}
          </p>
          <div className="flex justify-between items-center text-white/80 text-[10px]">
            <span>{dateStr}</span>
            <span>{sizeStr}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaCard;
