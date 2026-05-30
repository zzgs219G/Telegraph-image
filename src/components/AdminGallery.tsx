import React, { useState, useEffect, useRef, useCallback } from 'react';

interface MediaItem {
  url: string;
  fileId: string;
}

export default function AdminGallery() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());

  const observerRef = useRef<IntersectionObserver | null>(null);

  const fetchItems = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/admin/list?page=${p}`);
      if (response.ok) {
        const data: any = await response.json();
        setItems(data.items);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Failed to fetch admin list:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems(page);
  }, [page, fetchItems]);

  const toggleSelection = (url: string) => {
    const newSelection = new Set(selectedUrls);
    if (newSelection.has(url)) {
      newSelection.delete(url);
    } else {
      newSelection.add(url);
    }
    setSelectedUrls(newSelection);
  };

  const selectAll = () => {
    if (selectedUrls.size === items.length) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(items.map(i => i.url)));
    }
  };

  const deleteSelected = async () => {
    if (selectedUrls.size === 0) return;
    if (!confirm('你确定要删除选中的媒体文件吗？此操作无法撤回。')) return;

    try {
      const response = await fetch('/delete-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Array.from(selectedUrls))
      });

      if (response.ok) {
        alert('选中的媒体已删除');
        setSelectedUrls(new Set());
        fetchItems(page); // Reload current page
      } else {
        alert('删除失败');
      }
    } catch (error) {
      alert('删除失败');
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

  const copyLinks = (format: string) => {
    const urls = Array.from(selectedUrls);
    if (urls.length === 0) return;
    const formatted = formatLinks(urls, format);
    navigator.clipboard.writeText(formatted).then(() => {
      alert('复制成功');
    }).catch(() => alert('复制失败'));
  };

  const getFileExtension = (url: string) => url.split('.').pop()?.toLowerCase() || '';
  const getTimestamp = (url: string) => parseInt(url.split('/').pop()?.split('.')[0] || '0', 10);
  const isVideo = (ext: string) => ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'].includes(ext);
  const isImage = (ext: string) => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg'].includes(ext);

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5f7fa] to-[#e4e8f0] p-5 font-sans">
      <h1 className="text-[32px] font-bold bg-gradient-to-r from-[#667eea] to-[#764ba2] bg-clip-text text-transparent text-center mb-5 tracking-wide">
        图库管理
      </h1>

      <div className="sticky top-[10px] bg-white/85 backdrop-blur-md z-50 flex justify-between items-center mb-5 p-4 shadow-[0_4px_20px_rgba(102,126,234,0.15)] rounded-2xl border border-white/60 flex-wrap gap-4">
        <div className="flex-1 flex gap-4 items-center text-gray-700 font-medium">
          <span>媒体文件 {total} 个</span>
          <span>已选中: <span>{selectedUrls.size}</span>个</span>
        </div>

        {selectedUrls.size > 0 && (
          <div className="flex gap-2 justify-end flex-1 flex-wrap">
            <div className="relative group inline-block">
              <button className="bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white border-none rounded-lg px-5 py-2.5 cursor-pointer transition-all font-medium shadow-[0_4px_15px_rgba(102,126,234,0.3)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(102,126,234,0.4)]">
                复制
              </button>
              <div className="hidden group-hover:block absolute right-0 top-full mt-1 bg-white/95 backdrop-blur-md min-w-[140px] shadow-[0_8px_25px_rgba(0,0,0,0.15)] z-[1001] rounded-xl border border-white/60 overflow-hidden">
                <button onClick={() => copyLinks('url')} className="block w-full text-left px-4 py-3 text-sm text-gray-800 hover:bg-gradient-to-br hover:from-[#667eea]/10 hover:to-[#764ba2]/10 hover:text-[#667eea]">URL</button>
                <button onClick={() => copyLinks('bbcode')} className="block w-full text-left px-4 py-3 text-sm text-gray-800 hover:bg-gradient-to-br hover:from-[#667eea]/10 hover:to-[#764ba2]/10 hover:text-[#667eea]">BBCode</button>
                <button onClick={() => copyLinks('markdown')} className="block w-full text-left px-4 py-3 text-sm text-gray-800 hover:bg-gradient-to-br hover:from-[#667eea]/10 hover:to-[#764ba2]/10 hover:text-[#667eea]">Markdown</button>
              </div>
            </div>
            <button onClick={selectAll} className="bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white border-none rounded-lg px-5 py-2.5 cursor-pointer transition-all font-medium shadow-[0_4px_15px_rgba(102,126,234,0.3)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(102,126,234,0.4)]">
              {selectedUrls.size === items.length ? '取消全选' : '全选'}
            </button>
            <button onClick={deleteSelected} className="bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white border-none rounded-lg px-5 py-2.5 cursor-pointer transition-all font-medium shadow-[0_4px_15px_rgba(102,126,234,0.3)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(102,126,234,0.4)]">
              删除
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
        {loading ? (
          <div className="col-span-full text-center py-20 text-gray-400">加载中...</div>
        ) : items.length === 0 ? (
          <div className="col-span-full text-center py-20 text-gray-400 bg-white/60 rounded-2xl backdrop-blur-md text-lg">
            <span className="text-[72px] mb-5 block opacity-40">📁</span>
            <div>暂无媒体文件</div>
          </div>
        ) : (
          items.map((item) => {
            const ext = getFileExtension(item.url);
            const ts = getTimestamp(item.url);
            const isSelected = selectedUrls.has(item.url);
            const isV = isVideo(ext);
            const isI = isImage(ext);
            const supported = isV || isI;

            return (
              <div
                key={item.url}
                onClick={() => toggleSelection(item.url)}
                className={`relative overflow-hidden rounded-2xl bg-white/90 backdrop-blur-md shadow-[0_4px_15px_rgba(0,0,0,0.08)] border aspect-square transition-all cursor-pointer hover:-translate-y-1 hover:shadow-[0_8px_25px_rgba(102,126,234,0.2)] hover:border-[#667eea]/30 ${
                  isSelected ? 'border-2 border-[#667eea] bg-[#667eea]/10 shadow-[0_0_20px_rgba(102,126,234,0.3)]' : 'border-white/60'
                }`}
              >
                <div className="absolute top-2.5 left-2.5 bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white px-2.5 py-1 rounded-full text-xs font-medium z-10 uppercase tracking-wide">
                  {ext}
                </div>

                {supported ? (
                  isV ? (
                    <video src={item.url} className="w-full h-full object-contain" controls preload="none" />
                  ) : (
                    <img src={item.url} alt="media" className="w-full h-full object-contain" loading="lazy" />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[50px]">📁</div>
                )}

                {isSelected && (
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-white/90 backdrop-blur-sm px-2.5 py-2 rounded-lg text-gray-600 text-xs z-10">
                    上传时间: {new Date(ts).toLocaleString('zh-CN')}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {total > 0 && (
        <div className="flex justify-center items-center gap-3 my-6 p-4 bg-white/60 rounded-2xl backdrop-blur-md flex-wrap">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white border-none rounded-lg px-6 py-2.5 cursor-pointer transition-all font-medium shadow-[0_4px_15px_rgba(102,126,234,0.3)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(102,126,234,0.4)] disabled:from-gray-300 disabled:to-gray-400 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
          >
            上一页
          </button>
          <span className="text-gray-600 font-medium px-4">
            第 {page} / {totalPages} 页 (共 {total} 个)
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white border-none rounded-lg px-6 py-2.5 cursor-pointer transition-all font-medium shadow-[0_4px_15px_rgba(102,126,234,0.3)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(102,126,234,0.4)] disabled:from-gray-300 disabled:to-gray-400 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
          >
            下一页
          </button>
        </div>
      )}

      <div className="mt-8 text-center text-base text-gray-400 p-5 bg-white/60 rounded-xl backdrop-blur-md">
        到底啦
      </div>
    </div>
  );
}
