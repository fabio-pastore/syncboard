import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * A wrapper component that redirects unauthenticated users to the login page.
 *
 * It accesses the authentication state from the AuthContext. While the auth state
 * is loading, it renders nothing. If the user is not authenticated, it redirects
 * to the `/login` route; otherwise, it renders its children.
 *
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - The protected content to render.
 * @returns {JSX.Element|null} The protected content or a redirect.
 */

export default function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) return null;
    if (!user) return <Navigate to="/login" replace />; // doesn't work if not importing BrowserRouter in main.jsx, because navigate tag needs to be used inside a router
    return children;

}