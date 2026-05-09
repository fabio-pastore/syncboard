import { createContext, useContext, useState, useEffect } from "react";
import { apiFetch } from "../api";

const AuthContext = createContext();

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

    // here we set the token and user in local storage and in state, so that the app knows we're logged in
    async function login(identifier, password) {
        const data = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ identifier, password }),
            skipAuthRedirect: true,
        });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
    }

    function logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);  // this way the app doesn't still think we're logged in after logging out
    }

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

export function useAuth() {
    return useContext(AuthContext);
}   // i forgot to add before, nothing renders otherwise