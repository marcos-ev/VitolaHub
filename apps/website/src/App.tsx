import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Nav } from './components/Nav';
import { Footer } from './components/Footer';
import { ScrollToTop } from './components/ScrollToTop';
import { HomePage } from './pages/HomePage';
import { ContatoPage } from './pages/ContatoPage';
import { FundadorPage } from './pages/FundadorPage';

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Nav />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/contato" element={<ContatoPage />} />
        <Route path="/fundador" element={<FundadorPage />} />
        <Route path="/founding-member" element={<Navigate to="/fundador" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  );
}
