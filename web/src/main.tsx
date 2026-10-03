import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { DashboardPage } from './dashboard';
import { HomePage, LoginPage } from './home';
import './styles.css';

function DashboardRoute() {
  const { user, loading } = useAuth();
  if (loading) return <main className="dashboard-loading"><div className="loading-line" /><span>Checking your Discord session…</span></main>;
  return user ? <DashboardPage /> : <Navigate to="/login" replace />;
}

function App() {
  return <AuthProvider><BrowserRouter><Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/dashboard/*" element={<DashboardRoute />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></BrowserRouter></AuthProvider>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);