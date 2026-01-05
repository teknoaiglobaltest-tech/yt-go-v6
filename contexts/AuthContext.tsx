import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';

export interface AuthContextType {
  token: string | null;
  setToken: (token: string) => void;
  clearToken: () => void;
  refreshToken: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};


export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const refreshToken = async () => {
    const maxRetries = 3;
    const delay = 2000;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch("https://duniakreator.my.id/token.txt?cb=" + Date.now());
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch new token: ${response.status} ${errorText}`);
        }
        const newToken = await response.text();
        if (!newToken.trim()) {
            throw new Error('Fetched token is empty.');
        }
        setToken(newToken.trim());
        return; // Success
      } catch (e) {
          console.error(`Refresh token attempt ${attempt} failed:`, e);
          if (attempt === maxRetries) {
              throw e; // Re-throw the last error
          }
          await new Promise(res => setTimeout(res, delay));
      }
    }
  };

  useEffect(() => {
    const initializeAndRefresh = async () => {
      // Attempt to refresh the token on every application load.
      try {
        await refreshToken();
      } catch (error) {
        console.error("Failed to refresh token on initial load, will use stored token if available.", error);
        // If refresh fails, fall back to whatever is in local storage.
        const storedToken = localStorage.getItem('authToken');
        if (storedToken && !token) { // Only set if not already set by a successful refresh
          setTokenState(storedToken);
        }
      } finally {
        // Mark the app as initialized so it can render.
        setIsInitialized(true);
      }
    };

    initializeAndRefresh();
  }, []); // Empty dependency array ensures this runs only once on mount.

  const setToken = (newToken: string) => {
    const trimmedToken = newToken.trim();
    localStorage.setItem('authToken', trimmedToken);
    setTokenState(trimmedToken);
  };

  const clearToken = () => {
    localStorage.removeItem('authToken');
    setTokenState(null);
  };

  const value = { token, setToken, clearToken, refreshToken };

  if (!isInitialized) {
    return null; // or a loading spinner
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
