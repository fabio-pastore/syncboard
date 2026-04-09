import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Board from './pages/Board';


export default function App() {
  const { user, loading } = useAuth();
  if (loading) return null; // or a loading spinner, but this is simpler

  return (
    <Routes>
      <Route path='/login' element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path='/signup' element={user ? <Navigate to="/dashboard" replace /> : <Signup />} />
      <Route path='/' element={<ProtectedRoute><Dashboard /></ProtectedRoute>} /> {/* this way the dashboard page is protected, and we need to be logged in to see it */}
      <Route path="/board/:id" element={<ProtectedRoute><Board /></ProtectedRoute>} />
      <Route path="/board/share/:token" element={<ProtectedRoute><Board shared /></ProtectedRoute>} />
      <Route path='*' element={<Navigate to={user ? "/" : "/login"} replace />} /> {/* if the user tries to go to a page that doesn't exist, we redirect them to the dashboard if they're logged in, and to the login page if they're not */}
    </Routes>
  )
}