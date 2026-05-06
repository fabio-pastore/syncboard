import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Board from './pages/Board';
import LoadingScreen from './components/LoadingScreen';

export default function App() {
  const SIMULATED_LOAD_TIME = 1100; // ms
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    setIsNavigating(true);
    const timer = setTimeout(() => {
      setIsNavigating(false);
    }, SIMULATED_LOAD_TIME);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  if (authLoading || isNavigating) return <LoadingScreen />;

  return (
    <Routes>
      <Route path='/' element={user ? <Navigate to="/dashboard" replace /> : <Home />} />
      <Route path='/login' element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path='/signup' element={user ? <Navigate to="/dashboard" replace /> : <Signup />} />
      <Route path='/dashboard' element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/board/:id" element={<ProtectedRoute><Board /></ProtectedRoute>} />
      <Route path="/board/share/:token" element={<ProtectedRoute><Board shared /></ProtectedRoute>} />
      <Route path='*' element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
    </Routes>
  )
}
