import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth';
import { supabase } from '../api/supabase';

interface Staff {
  id: string;
  username: string;
  name: string;
}

interface AuthContextType {
  staff: Staff | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    void supabase.auth.signOut();
    setStaff(null);
  }, []);

  useEffect(() => {
    let active = true;
    const loadSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        const profile = await authApi.getMe();
        if (active && profile.isActive) {
          setStaff({ id: profile.id, username: profile.username, name: profile.name });
        }
      } catch {
        if (active) logout();
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void loadSession();

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && active) setStaff(null);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [logout]);

  const login = async (username: string, password: string) => {
    const response = await authApi.login(username, password);
    setStaff(response.staff);
  };

  return (
    <AuthContext.Provider value={{ staff, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus digunakan dalam AuthProvider');
  return ctx;
};
