import React from 'react';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Chat } from './components/Chat';
import { Login } from './components/Login';

const AppContent = () => {
    const { user, isLoading, logout } = useAuth();

    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center bg-[#1a1a1a]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-300">Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Login />;
    }

    return (
        <div className="h-screen flex flex-col" style={{ backgroundColor: '#1a1a1a' }}>
            <header className="border-b p-4 flex justify-between items-center shrink-0" style={{ backgroundColor: '#2d2d2d', borderColor: '#404040' }}>
                <h1 className="text-2xl font-bold text-white">AI Chatbot</h1>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-300">
                        Welcome, {user.username}
                    </span>
                    <button
                        onClick={logout}
                        className="px-4 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                        Logout
                    </button>
                </div>
            </header>
            <div className="flex-1 overflow-hidden">
                <Chat />
            </div>
        </div>
    );
};

function App() {
    return (
        <Provider store={store}>
            <AuthProvider>
                <AppContent />
            </AuthProvider>
        </Provider>
    );
}

export default App;
