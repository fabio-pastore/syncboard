import { createContext, useContext, useState, useEffect } from "react";
import { apiFetch } from "../api";

const AuthContext = createContext();

/**
 * Provides authentication state and methods to all descendant components.
 *
 * Manages the current user, token validation, and exposes signup, login,
 * logout, and user update functions. Checks token expiration on initial load.
 *
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - The child components to wrap.
 * @returns {JSX.Element} The context provider element.
 */

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const stored = localStorage.getItem('user');
        if (token && stored) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                if (payload.exp * 1000 < Date.now()) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setUser(null);
                    setLoading(false);
                    return;
                }
            } catch {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                setUser(null);
                setLoading(false);
                return;
            }
            setUser(JSON.parse(stored));
        }
        setLoading(false);
    }, []);

    /**
     * Registers a new user, stores the token, and sets the user state.
     *
     * @param {string} email - The user's email address.
     * @param {string} username - The desired username.
     * @param {string} password - The user's password.
     * @returns {Promise<void>}
     */
    async function signup(email, username, password) {
        const data = await apiFetch('/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ email, username, password }),
            skipAuthRedirect: true,
        });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
    }

    /**
     * Logs in an existing user with email or username, stores the token, and sets the user state.
     *
     * @param {string} identifier - The user's email or username.
     * @param {string} password - The user's password.
     * @returns {Promise<void>}
     */
    async function login(identifier, password) {
        const data = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ identifier, password }),
            skipAuthRedirect: true,
        });
        localStorage.setItem('token', data.token); // here we set the token and user in local storage and in state, so that the app knows we're logged in
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
    }

    /**
     * Logs out the current user by removing stored credentials and clearing state.
     */
    function logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);  // this way the app doesn't still think we're logged in after logging out
    }

    /**
     * Updates the local user state and localStorage with a new user object.
     * Typically used after profile updates.
     *
     * @param {object} updatedUser - The updated user data from the server.
     */
    function updateUser(updatedUser) {
        const newUser = {
            id: updatedUser._id, 
            email: updatedUser.email, 
            username: updatedUser.username,
            profileImage: updatedUser.profileImage || null,
        };
        localStorage.setItem('user', JSON.stringify(newUser));
        setUser(newUser);
    }

    return (
        <AuthContext.Provider value={{ user, loading, signup, login, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    )
}

/**
 * Custom hook to access the authentication context.
 *
 * Must be used within an AuthProvider.
 *
 * @returns {object} The auth context value, including `user`, `loading`, `signup`, `login`, `logout`, and `updateUser`.
 */
export function useAuth() {
    return useContext(AuthContext);
}   // i forgot to add before, nothing renders otherwise