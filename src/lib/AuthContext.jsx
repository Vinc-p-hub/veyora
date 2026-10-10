import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext();

// Merge the Supabase auth user with its `profiles` row (role, staff_role, full_name, ...).
async function loadUser(authUser) {
  if (!authUser) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();
  return {
    ...(profile || {}),
    id: authUser.id,
    email: authUser.email,
    full_name: profile?.full_name || authUser.user_metadata?.full_name || authUser.user_metadata?.name || '',
    role: profile?.role || 'user',
    staff_role: profile?.staff_role || null,
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState(null);

  const applySession = useCallback(async (session) => {
    try {
      setUser(await loadUser(session?.user ?? null));
      setAuthError(null);
    } catch (error) {
      console.error('Auth profile load failed:', error);
      setUser(null);
      setAuthError({ type: 'unknown', message: error.message || 'Failed to load profile' });
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  const checkUserAuth = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await applySession(data.session);
  }, [applySession]);

  useEffect(() => {
    checkUserAuth();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Defer: never call supabase from inside the auth callback synchronously (deadlock risk).
      setTimeout(() => applySession(session), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [checkUserAuth, applySession]);

  const logout = async (redirectTo = '/') => {
    setUser(null);
    await supabase.auth.signOut();
    if (redirectTo) window.location.href = redirectTo;
  };

  const navigateToLogin = () => {
    const returnTo = window.location.pathname + window.location.search;
    window.location.href = '/login' + (returnTo !== '/' ? '?returnTo=' + encodeURIComponent(returnTo) : '');
  };

  // Update the signed-in user's own profile (RLS + trigger keep roles untouchable).
  const updateProfile = async (patch) => {
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', user.id)
      .select()
      .single();
    if (error) throw error;
    setUser((prev) => ({ ...prev, ...data }));
    return data;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoadingAuth,
        isLoadingPublicSettings: false,
        authError,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
