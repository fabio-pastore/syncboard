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
            setUser(JSON.parse(stored));
        }
        setLoading(false);
    }, []);

    async function signup(email, username, password) {
        const data = await apiFetch('/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ email, username, password }),
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

    return (
        <AuthContext.Provider value={{ user, loading, signup, login, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    return useContext(AuthContext);
}   // i forgot to add before, nothing renders otherwise