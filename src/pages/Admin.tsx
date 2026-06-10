import React, { useState, useEffect } from 'react';
import { getAdminMedia, deleteAdminMedia, getTags, createTag, deleteTag, batchTagMedia, triggerBingCrawl } from '../services/api';
import type { MediaItem, Tag } from '../types';
import Sidebar from '../components/admin/Sidebar';
import TagModal from '../components/admin/TagModal';
import Toolbar from '../components/admin/Toolbar';
import MediaGrid from '../components/admin/MediaGrid';
import BatchBar from '../components/admin/BatchBar';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent } from '@/components/ui/sheet';

const AdminPage: React.FC = () => {
  const [token, setToken] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState(''); // Default usually
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // New states for phase 3
  const [tags, setTags] = useState<Tag[]>([]);
  const [activeTagId, setActiveTagId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isSubmittingTag, setIsSubmittingTag] = useState(false);
  const [isDeletingTag, setIsDeletingTag] = useState<number | null>(null);
  const [isCrawlingBing, setIsCrawlingBing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const cachedToken = sessionStorage.getItem('admin_token');
    if (!cachedToken) return;
    setIsLoading(true);
    getAdminMedia(1, cachedToken)
      .then((res) => {
        if (res.data) {
          setToken(cachedToken);
          setIsAuthenticated(true);
          setMedia(res.data);
          setPage(res.pagination.page);
          setTotalPages(res.pagination.totalPages);
          setTotalCount(res.pagination.totalCount);
        } else {
          sessionStorage.removeItem('admin_token');
        }
      })
      .catch(() => sessionStorage.removeItem('admin_token'))
      .finally(() => setIsLoading(false));
  }, []);

  const authenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    const encodedToken = btoa(`${username}:${password}`);
    setIsLoading(true);
    try {
      const res = await getAdminMedia(1, encodedToken);
      if (res.data) {
        setToken(encodedToken);
        sessionStorage.setItem('admin_token', encodedToken);
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

  const fetchTags = async () => {
    try {
      const res = await getTags();
      if (res.data) setTags(res.data);
    } catch (e) {
      console.error('Failed to load tags', e);
    }
  };

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchTags();
      loadPage(1, activeTagId);
    }
  }, [isAuthenticated, token, activeTagId]);

  const loadPage = async (newPage: number, tagId: number | null = activeTagId) => {
    setIsLoading(true);
    try {
      const res = await getAdminMedia(newPage, token, tagId);
      if (res.data) {
        setMedia(res.data);
        setPage(res.pagination.page);
        setTotalPages(res.pagination.totalPages);
        setTotalCount(res.pagination.totalCount);
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

  const handleCreateTag = async (name: string, color: string) => {
    setIsSubmittingTag(true);
    try {
      await createTag(name, color, token);
      await fetchTags();
      setIsTagModalOpen(false);
    } catch (e: unknown) {
      alert(`创建失败: ${e.response?.data?.error || e.message}`);
    } finally {
      setIsSubmittingTag(false);
    }
  };

  const handleDeleteTag = async (id: number) => {
    if (!confirm('确定删除该标签吗？打上此标签的媒体不会被删除。')) return;
    setIsDeletingTag(id);
    try {
      await deleteTag(id, token);
      if (activeTagId === id) setActiveTagId(null);
      await fetchTags();
      await loadPage(page, activeTagId === id ? null : activeTagId);
    } catch (e: unknown) {
      alert(`删除失败: ${e.message}`);
    } finally {
      setIsDeletingTag(null);
    }
  };

  const handleBatchTag = async (tagId: number | null) => {
    if (selectedKeys.size === 0) return;
    try {
      await batchTagMedia(Array.from(selectedKeys), tagId, token);
      alert('批量操作成功');
      setSelectedKeys(new Set());
      fetchTags();
      loadPage(page);
    } catch (e: unknown) {
      alert(`操作失败: ${e.message}`);
    }
  };

  const handleTriggerBingCrawl = async () => {
    setIsCrawlingBing(true);
    try {
      const res = await triggerBingCrawl(token);
      alert(`抓取完成：成功 ${res.success} 张，跳过 ${res.skipped} 张已存在`);
      fetchTags();
      loadPage(1);
    } catch (e: unknown) {
      alert(`抓取失败: ${e.message}`);
    } finally {
      setIsCrawlingBing(false);
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
    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="text-slate-500 text-sm animate-pulse">正在验证登录状态...</div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-sm border border-slate-100">
          <div className="flex justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-600">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-1 text-center text-slate-800">后台管理</h2>
          <p className="text-sm text-slate-400 text-center mb-6">Telegraph 图床</p>
          <form onSubmit={authenticate} className="space-y-4">
            <Input
              type="text"
              placeholder="用户名"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
            <Input
              type="password"
              placeholder="密码"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? '验证中...' : '登录'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const filteredMedia = media.filter(item =>
    !searchTerm ||
    (item.filename && item.filename.toLowerCase().includes(searchTerm.toLowerCase())) ||
    item.url.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center shrink-0">
        <div className="flex items-center space-x-2">
          <button
            className="md:hidden p-1 mr-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Telegraph 图床后台</h1>
        </div>
        <button
          onClick={() => {
            setIsAuthenticated(false);
            setToken('');
            sessionStorage.removeItem('admin_token');
          }}
          className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          退出登录
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* 桌面端固定侧边栏 */}
        <div className="hidden md:block">
          <Sidebar
            tags={tags}
            activeTagId={activeTagId}
            onSelectTag={(id) => { setActiveTagId(id); setSelectedKeys(new Set()); }}
            onNewTag={() => setIsTagModalOpen(true)}
            onDeleteTag={handleDeleteTag}
            isDeletingTag={isDeletingTag}
            totalCount={totalCount}
          />
        </div>

        {/* 移动端抽屉 - 使用 shadcn Sheet */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="p-0 w-64">
            <Sidebar
              tags={tags}
              activeTagId={activeTagId}
              onSelectTag={(id) => {
                setActiveTagId(id);
                setSelectedKeys(new Set());
                setSidebarOpen(false);
              }}
              onNewTag={() => setIsTagModalOpen(true)}
              onDeleteTag={handleDeleteTag}
              isDeletingTag={isDeletingTag}
              totalCount={totalCount}
            />
          </SheetContent>
        </Sheet>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          <Toolbar
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            viewMode={viewMode}
            setViewMode={setViewMode}
            onUploadSuccess={() => { fetchTags(); loadPage(1); }}
            token={token}
            activeTag={tags.find(t => t.id === activeTagId)}
            onTriggerBingCrawl={handleTriggerBingCrawl}
            isCrawlingBing={isCrawlingBing}
          />

          <MediaGrid
            media={filteredMedia}
            selectedUrls={selectedKeys}
            toggleSelect={toggleSelect}
            viewMode={viewMode}
            isLoading={isLoading}
            page={page}
            totalPages={totalPages}
            setPage={(p) => loadPage(p)}
          />
        </div>
      </div>

      <BatchBar
        selectedCount={selectedKeys.size}
        onClearSelect={() => setSelectedKeys(new Set())}
        onDelete={handleDelete}
        onBatchTag={handleBatchTag}
        onCopyLinks={handleCopy}
        tags={tags}
      />

      <TagModal
        isOpen={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        onSubmit={handleCreateTag}
        isSubmitting={isSubmittingTag}
      />
    </div>
  );
};

export default AdminPage;
