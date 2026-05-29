import { BrowserRouter, Routes, Route } from 'react-router-dom';
import UploaderPage from './pages/Uploader';
import AdminPage from './pages/Admin';
import Background from './components/Background';

function App() {
  return (
    <BrowserRouter>
      <Background />
      <Routes>
        <Route path="/" element={<UploaderPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
