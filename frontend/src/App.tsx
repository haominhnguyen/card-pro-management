import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { ConfigProvider, App as AntApp, Button, Spin } from 'antd';
import { QueryClientProvider } from '@tanstack/react-query';
import { API_URL } from './api/axiosClient';
import { getAccessToken } from './auth/tokenStore';
import { AuthProvider, useAuth } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { queryClient, qk } from './hooks/queryClient';
import { useCards, useTransactions, useStats, useBanks } from './hooks/useData';
import { appTheme } from './lib/theme';
import type { Transaction } from './types';
import AppHeader from './components/AppHeader';
import AddTransactionDrawer from './components/AddTransactionDrawer';
import AddCardDrawer from './components/AddCardDrawer';
import DemoBanner from './components/DemoBanner';
import { isDemo } from './demo/demoMode';

const DashboardView = lazy(() => import('./components/DashboardView'));
const CardsView = lazy(() => import('./components/CardsView'));
const TransactionsView = lazy(() => import('./components/TransactionsView'));
const AnalyticsView = lazy(() => import('./components/AnalyticsView'));

function AppContent() {
  const { notification } = AntApp.useApp();
  const { demo } = useAuth();
  const navigate = useNavigate();
  const socketRef = useRef<Socket | null>(null);

  const cardsQ = useCards();
  const txQ = useTransactions();
  const statsQ = useStats();
  const banksQ = useBanks();

  const cards = cardsQ.data ?? [];
  const transactions = txQ.data ?? [];
  const stats = statsQ.data ?? [];
  const banks = banksQ.data ?? [];
  const loading = cardsQ.isLoading || txQ.isLoading || statsQ.isLoading || banksQ.isLoading;
  const error = cardsQ.isError || txQ.isError || statsQ.isError || banksQ.isError;

  const [txDrawer, setTxDrawer] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [cardDrawer, setCardDrawer] = useState(false);

  const openAddTx = () => { setEditingTx(null); setTxDrawer(true); };
  const openEditTx = (tx: Transaction) => { setEditingTx(tx); setTxDrawer(true); };

  // Surface connection failures as a toast (with a retry action).
  useEffect(() => {
    if (error) {
      notification.error({
        key: 'conn-error',
        message: 'Không thể kết nối tới máy chủ',
        description: 'Kiểm tra backend đang chạy tại cổng 3000 rồi thử lại.',
        duration: 0,
        btn: (
          <Button size="small" type="primary" onClick={() => queryClient.invalidateQueries()}>
            Thử lại
          </Button>
        ),
      });
    } else {
      notification.destroy('conn-error');
    }
  }, [error, notification]);

  // Realtime: bất kỳ thay đổi giao dịch nào (web khác / bot / sheet) → làm mới list + stats.
  // Socket chỉ kết nối khi đã đăng nhập (AppContent nằm trong ProtectedRoute) và mang access token.
  // Chế độ dùng thử không có backend → bỏ qua kết nối socket.
  useEffect(() => {
    if (isDemo()) return;
    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      auth: { token: getAccessToken() },
    });
    socketRef.current = socket;

    // Access token may have been refreshed since mount — re-auth on every reconnect.
    socket.io.on('reconnect_attempt', () => {
      socket.auth = { token: getAccessToken() };
    });

    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: qk.transactions });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    };
    socket.on('new_transaction', refresh);
    socket.on('transaction_updated', refresh);
    socket.on('transaction_deleted', refresh);
    return () => {
      socket.off('new_transaction', refresh);
      socket.off('transaction_updated', refresh);
      socket.off('transaction_deleted', refresh);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const fallback = (
    <div className="flex justify-center py-20">
      <Spin size="large" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader onAddTransaction={openAddTx} />
      {demo && <DemoBanner />}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Suspense fallback={fallback}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                <DashboardView
                  cards={cards}
                  transactions={transactions}
                  stats={stats}
                  banks={banks}
                  loading={loading}
                  onAddCard={() => setCardDrawer(true)}
                  onAddTransaction={openAddTx}
                  onViewAll={() => navigate('/transactions')}
                  onViewCards={() => navigate('/cards')}
                />
              }
            />
            <Route
              path="/cards"
              element={
                <CardsView
                  cards={cards}
                  stats={stats}
                  banks={banks}
                  loading={loading}
                  onAddCard={() => setCardDrawer(true)}
                />
              }
            />
            <Route
              path="/transactions"
              element={
                <TransactionsView
                  transactions={transactions}
                  banks={banks}
                  loading={txQ.isLoading}
                  onAdd={openAddTx}
                  onEdit={openEditTx}
                />
              }
            />
            <Route path="/analytics" element={<AnalyticsView />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </main>
      <AddTransactionDrawer
        open={txDrawer}
        editing={editingTx}
        cards={cards}
        banks={banks}
        onClose={() => setTxDrawer(false)}
        onSuccess={() => setTxDrawer(false)}
      />
      <AddCardDrawer
        open={cardDrawer}
        banks={banks}
        cards={cards}
        onClose={() => setCardDrawer(false)}
        onSuccess={() => setCardDrawer(false)}
      />
    </div>
  );
}

// Redirect already-authenticated users away from /login and /register.
function PublicOnly({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
      <Route element={<ProtectedRoute />}>
        <Route path="/*" element={<AppContent />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={appTheme}>
        <AntApp>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
