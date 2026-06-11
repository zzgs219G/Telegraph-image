import { BrowserRouter, Routes, Route } from 'react-router-dom';
import UploaderPage from './pages/Uploader';
import AdminPage from './pages/Admin';
import Background from './components/Background';
import { Toaster } from 'sonner';

/**
 * App 组件
 * 作为前端路由入口，包裹整个应用。
 * 包含全局背景组件、路由分发，以及全局 Toast 弹窗提供者。
 */
function App() {
  return (
    <BrowserRouter>
      <Background />
      <Routes>
        {/* 前台：上传图片页面 */}
        <Route path="/" element={<UploaderPage />} />
        {/* 后台：登录与图片管理页面 */}
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
      <Toaster position="top-center" richColors />
    </BrowserRouter>
  );
}

export default App;
