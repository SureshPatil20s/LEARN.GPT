'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@/types';
import { getCurrentUser, getToken, loginUser, loginWithGoogleApi, registerUser, setToken, updateCurrentUser, loginAsGuest } from '@/lib/api';
import { signInWithFirebaseEmail, signUpWithFirebaseEmail } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, name: string) => Promise<void>;
  loginWithGoogle: (emailOrToken: string, name?: string, avatar?: string, idToken?: string) => Promise<void>;
  loginGuest: () => Promise<void>;
  updateUser: (name?: string, avatar?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    const existingToken = getToken();
    if (existingToken) {
      setTokenState(existingToken);
      getCurrentUser()
        .then((userData) => {
          setUser(userData);
          setIsLoading(false);
        })
        .catch(() => {
          // Token expired, smoothly fallback to a guest session
          setToken(null);
          loginAsGuest()
            .then((res) => {
              setTokenState(res.access_token);
              setUser(res.user);
            })
            .catch(() => {
              setTokenState(null);
              setUser(null);
            })
            .finally(() => setIsLoading(false));
        });
    } else {
      // First-time visitor: auto-initialize seamless guest session
      loginAsGuest()
        .then((res) => {
          setTokenState(res.access_token);
          setUser(res.user);
        })
        .catch(() => {
          setTokenState(null);
          setUser(null);
        })
        .finally(() => setIsLoading(false));
    }
  }, []);

  const loginGuest = async () => {
    const res = await loginAsGuest();
    setTokenState(res.access_token);
    setUser(res.user);
    setAuthModalOpen(false);
  };

  const login = async (email: string, pass: string) => {
    try {
      // First attempt Firebase Email/Password Auth
      const fbUser = await signInWithFirebaseEmail(email, pass);
      const res = await loginWithGoogleApi(fbUser.email, fbUser.name, undefined, fbUser.idToken);
      setTokenState(res.access_token);
      setUser(res.user);
    } catch {
      // Fallback to local database authentication
      const res = await loginUser(email, pass);
      setTokenState(res.access_token);
      setUser(res.user);
    }
    setAuthModalOpen(false);
  };

  const register = async (email: string, pass: string, name: string) => {
    try {
      // First attempt Firebase Email/Password Sign Up
      const fbUser = await signUpWithFirebaseEmail(email, pass, name);
      const res = await loginWithGoogleApi(fbUser.email, fbUser.name, undefined, fbUser.idToken);
      setTokenState(res.access_token);
      setUser(res.user);
    } catch {
      // Fallback to local database registration
      const res = await registerUser(email, pass, name);
      setTokenState(res.access_token);
      setUser(res.user);
    }
    setAuthModalOpen(false);
  };

  const loginWithGoogle = async (emailOrToken: string, name?: string, avatar?: string, idToken?: string) => {
    // Determine whether first param is a JWT token or an email
    const isToken = typeof emailOrToken === 'string' &&
      emailOrToken.startsWith('eyJ') &&
      !emailOrToken.includes('@');

    const tokenToSend = isToken ? emailOrToken : idToken;
    const emailToSend = isToken ? undefined : emailOrToken;

    const res = await loginWithGoogleApi(
      emailToSend,
      name || '',
      avatar,
      tokenToSend
    );
    setTokenState(res.access_token);
    setUser(res.user);
    setAuthModalOpen(false);
  };

  const updateUser = async (name?: string, avatar?: string) => {
    const updated = await updateCurrentUser({ name, avatar_url: avatar });
    setUser(updated);
  };

  const logout = () => {
    setToken(null);
    setTokenState(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        authModalOpen,
        setAuthModalOpen,
        login,
        register,
        loginWithGoogle,
        loginGuest,
        updateUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

