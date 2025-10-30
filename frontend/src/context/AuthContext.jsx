import React, { createContext, useContext, useState, useEffect } from "react";
import { authApi } from "../services/api";

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadUser = async () => {
            try {
                const token = localStorage.getItem("token");
                if (token) {
                    const currentUser = await authApi.getCurrentUser();
                    setUser(currentUser);
                }
            } catch (error) {
                console.error("Failed to load user:", error);
                localStorage.removeItem("token");
            } finally {
                setIsLoading(false);
            }
        };

        loadUser();
    }, []);

    const login = async (email, password) => {
        const data = await authApi.login(email, password);
        setUser(data.user);
        return data;
    };

    const register = async (username, email, password) => {
        const data = await authApi.register(username, email, password);
        setUser(data.user);
        return data;
    };

    const logout = () => {
        setUser(null);
        authApi.logout();
    };

    return (
        <AuthContext.Provider
            value={{ user, login, register, logout, isLoading }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return context;
};
