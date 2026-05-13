import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Board from './pages/Board';
import LoadingScreen from './components/LoadingScreen';

/**
 * The root application component.
 *
 * Defines the main routing structure for the application, including
 * public, protected, and catch-all routes. It redirects authenticated users
 * away from login/signup pages and to the dashboard. A full-screen loading
 * indicator is displayed while the authentication state is being resolved.
 *
 * @returns {JSX.Element} The application routes wrapped in a React.Fragment.
 */

export default function App() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) return <LoadingScreen />;

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
