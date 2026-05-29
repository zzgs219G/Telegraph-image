import React, { useState } from 'react';
import { getAdminMedia, deleteAdminMedia } from '../services/api';
import type { MediaItem } from '../types';
import { Copy, Trash2, CheckSquare, FolderArchive } from 'lucide-react';

const AdminPage: React.FC = () => {
  const [token, setToken] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('admin'); // Default usually
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const authenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    const encodedToken = btoa(`${username}:${password}`);
    setIsLoading(true);
    try {
      const res = await getAdminMedia(1, encodedToken);
      if (res.data) {
        setToken(encodedToken);
        setIsAuthenticated(true);
        setMedia(res.data);
        setPage(res.pagination.page);
        setTotalPages(res.pagination.totalPages);
        setTotalCount(res.pagination.totalCount);
      } else {
        alert('认证失败');
      }
    } catch {
      alert('认证失败，请检查账号密码');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPage = async (newPage: number) => {
    setIsLoading(true);
    try {
      const res = await getAdminMedia(newPage, token);
      if (res.data) {
        setMedia(res.data);
        setPage(res.pagination.page);
        setTotalPages(res.pagination.totalPages);
      }
    } catch {
      alert('加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelect = (url: string) => {
    const newSelected = new Set(selectedKeys);
    if (newSelected.has(url)) {
      newSelected.delete(url);
    } else {
      newSelected.add(url);
    }
    setSelectedKeys(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedKeys.size === media.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(media.map(m => m.url)));
    }
  };

  const handleDelete = async () => {
    if (selectedKeys.size === 0) return;
    if (!confirm('确定删除选中的文件吗？不可恢复。')) return;

    setIsLoading(true);
    const res = await deleteAdminMedia(Array.from(selectedKeys), token);
    setIsLoading(false);

    if (res.message) {
      alert('删除成功');
      setSelectedKeys(new Set());
      loadPage(page);
    } else {
      alert(`删除失败: ${res.error}`);
    }
  };

  const handleCopy = (format: 'url' | 'bbcode' | 'markdown') => {
    const urls = Array.from(selectedKeys);
    if (urls.length === 0) return;

    let text = '';
    if (format === 'url') text = urls.join('\\n\\n');
    else if (format === 'bbcode') text = urls.map(u => `[img]${u}[/img]`).join('\\n\\n');
    else if (format === 'markdown') text = urls.map(u => `![image](${u})`).join('\\n\\n');

    navigator.clipboard.writeText(text).then(() => alert('复制成功')).catch(() => alert('复制失败'));
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <form onSubmit={authenticate} className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm">
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">后台管理</h2>
          <input
            type="text"
            placeholder="用户名"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full mb-4 p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            required
          />
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full mb-6 p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            required
          />
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {isLoading ? '验证中...' : '登录'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-center text-indigo-700 mb-8">图库管理</h1>

        <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm p-4 mb-6 flex flex-wrap justify-between items-center gap-4 sticky top-4 z-10 border border-gray-200">
          <div className="text-gray-600 font-medium">
            共 {totalCount} 个文件 | 已选 {selectedKeys.size} 个
          </div>

          <div className={`flex gap-3 ${selectedKeys.size > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity`}>
            <div className="relative group">
              <button className="flex items-center gap-2 bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-600 transition shadow">
                <Copy size={16} /> 复制
              </button>
              <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-xl border overflow-hidden hidden group-hover:block w-32">
                <button onClick={() => handleCopy('url')} className="w-full text-left px-4 py-2 hover:bg-indigo-50 text-sm">URL</button>
                <button onClick={() => handleCopy('bbcode')} className="w-full text-left px-4 py-2 hover:bg-indigo-50 text-sm">BBCode</button>
                <button onClick={() => handleCopy('markdown')} className="w-full text-left px-4 py-2 hover:bg-indigo-50 text-sm">Markdown</button>
              </div>
            </div>

            <button onClick={toggleSelectAll} className="flex items-center gap-2 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition">
              <CheckSquare size={16} /> 全选
            </button>
            <button onClick={handleDelete} className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition shadow">
              <Trash2 size={16} /> 删除
            </button>
          </div>
        </div>

        {media.length === 0 ? (
          <div className="text-center py-20 text-gray-400 bg-white rounded-xl shadow-sm">
            <FolderArchive size={48} className="mx-auto mb-4 opacity-50" />
            <p>暂无媒体文件</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {media.map((item) => {
              const isSelected = selectedKeys.has(item.url);
              const ext = item.url.split('.').pop()?.toLowerCase() || '';
              const isVideo = ['mp4', 'webm', 'mov'].includes(ext);
              const timestampMatch = item.url.match(/\/(\d+)\./);
              const timestamp = timestampMatch ? new Date(parseInt(timestampMatch[1])).toLocaleString() : '';

              return (
                <div
                  key={item.url}
                  onClick={() => toggleSelect(item.url)}
                  className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer bg-white shadow-sm border-2 transition-all ${
                    isSelected ? 'border-indigo-500 scale-95 shadow-indigo-200' : 'border-transparent hover:shadow-md'
                  }`}
                >
                  <div className="absolute top-2 left-2 z-10 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full uppercase">
                    {ext}
                  </div>

                  {isVideo ? (
                    <video src={item.url} className="w-full h-full object-cover" />
                  ) : (
                    <img src={item.url} loading="lazy" className="w-full h-full object-cover" alt="" />
                  )}

                  {isSelected && (
                    <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur p-2 text-xs text-center text-gray-600">
                      {timestamp}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-8 bg-white/60 backdrop-blur p-4 rounded-xl shadow-sm">
            <button
              disabled={page <= 1}
              onClick={() => loadPage(page - 1)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50 disabled:bg-gray-400"
            >
              上一页
            </button>
            <span className="font-medium text-gray-600">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => loadPage(page + 1)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50 disabled:bg-gray-400"
            >
              下一页
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
