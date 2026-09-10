import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { LeadsPage } from './pages/LeadsPage';
import { ConversationsPage } from './pages/ConversationsPage';
import { ConversationThreadPage } from './pages/ConversationThreadPage';
import { ProfilePage } from './pages/ProfilePage';
import { ReviewsPage } from './pages/ReviewsPage';
import { SubscriptionPage } from './pages/SubscriptionPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/conversas" element={<ConversationsPage />} />
          <Route path="/conversas/:id" element={<ConversationThreadPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/avaliacoes" element={<ReviewsPage />} />
          <Route path="/assinatura" element={<SubscriptionPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
