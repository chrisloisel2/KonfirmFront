import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, UserRole, ApiResponse, LoginResponse, SignupResponse } from '../types';
import { API_BASE } from '../config/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  selectedRole?: UserRole;
  selectedBranch?: string;
}

type AuthAction =
  | { type: 'AUTH_LOADING' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'AUTH_FAILURE' }
  | { type: 'LOGOUT' }
  | { type: 'SET_ROLE'; payload: UserRole }
  | { type: 'SET_BRANCH'; payload: string }
  | { type: 'RESTORE_AUTH'; payload: { user: User; token: string; selectedRole?: UserRole; selectedBranch?: string } };

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
};

const STORAGE_KEYS = {
  token: 'authToken',
  user: 'userData',
  role: 'selectedRole',
  branch: 'selectedBranch',
} as const;

function normalizeRole(role: unknown): UserRole {
  switch (String(role ?? '').toLowerCase()) {
    case 'conseiller':
      return 'conseiller';
    case 'caisse':
      return 'caisse';
    case 'referent':
    case 'référent':
      return 'referent';
    case 'responsable':
      return 'responsable';
    case 'admin':
      return 'admin';
    default:
      return 'conseiller';
  }
}

function normalizeUser(input: Partial<User> | null | undefined): User {
  return {
    id: input?.id ?? '',
    email: input?.email ?? '',
    role: normalizeRole(input?.role),
    firstName: input?.firstName,
    lastName: input?.lastName,
    companyName: input?.companyName,
    branch: input?.branch ?? '',
    isActive: input?.isActive ?? true,
    permissions: Array.isArray(input?.permissions) ? input?.permissions : [],
    lastLogin: input?.lastLogin ? String(input.lastLogin) : null,
  };
}

function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    if (typeof globalThis.atob !== 'function') return null;

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4 || 4)) % 4);
    const decoded = globalThis.atob(padded);

    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 <= Date.now();
}

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_LOADING':
      return { ...state, isLoading: true };

    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        selectedRole: action.payload.user.role,
        selectedBranch: action.payload.user.branch || undefined,
      };

    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };

    case 'LOGOUT':
      return {
        ...initialState,
        isLoading: false,
      };

    case 'SET_ROLE':
      return { ...state, selectedRole: action.payload };

    case 'SET_BRANCH':
      return { ...state, selectedBranch: action.payload };

    case 'RESTORE_AUTH':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        selectedRole: action.payload.selectedRole ?? action.payload.user.role,
        selectedBranch: action.payload.selectedBranch,
      };

    default:
      return state;
  }
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (payload: {
    email: string;
    password: string;
    confirmPassword: string;
    firstName: string;
    lastName: string;
    companyName: string;
    activationKey: string;
  }) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  setRole: (role: UserRole) => void;
  setBranch: (branch: string) => void;
  hasPermission: (permission: string) => boolean;
  canAccess: (screen: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Intercepteur global : tout fetch vers /api/ qui répond 401 → logout automatique
  useEffect(() => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
      const response = await originalFetch(...args);
      if (response.status === 401 && String(args[0]).includes('/api/')) {
        await AsyncStorage.multiRemove([
          STORAGE_KEYS.token,
          STORAGE_KEYS.user,
          STORAGE_KEYS.role,
          STORAGE_KEYS.branch,
        ]);
        dispatch({ type: 'LOGOUT' });
      }
      return response;
    };
    return () => { globalThis.fetch = originalFetch; };
  }, []);

  // Restaurer l'authentification au démarrage
  useEffect(() => {
    restoreAuth();
  }, []);

  const restoreAuth = async () => {
    try {
      const [token, userData, , selectedBranch] = await AsyncStorage.multiGet([
        STORAGE_KEYS.token,
        STORAGE_KEYS.user,
        STORAGE_KEYS.role,
        STORAGE_KEYS.branch,
      ]).then(entries => entries.map(([, value]) => value));

      if (token && userData && !isTokenExpired(token)) {
        const user = normalizeUser(JSON.parse(userData));
        dispatch({
          type: 'RESTORE_AUTH',
          payload: {
            user,
            token,
            selectedRole: user.role,
            selectedBranch: selectedBranch ?? undefined,
          },
        });
      } else {
        await AsyncStorage.multiRemove([
          STORAGE_KEYS.token,
          STORAGE_KEYS.user,
          STORAGE_KEYS.role,
          STORAGE_KEYS.branch,
        ]);
        dispatch({ type: 'AUTH_FAILURE' });
      }
    } catch (error) {
      console.error('Erreur lors de la restauration de l\'authentification:', error);
      dispatch({ type: 'AUTH_FAILURE' });
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    dispatch({ type: 'AUTH_LOADING' });

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const result: ApiResponse<LoginResponse> | null = await response.json().catch(() => null);

      if (response.ok && result?.success && result.data?.token && result.data?.user) {
        const token = result.data.token;
        const user = normalizeUser(result.data.user);

        const storageEntries: [string, string][] = [
          [STORAGE_KEYS.token, token],
          [STORAGE_KEYS.user, JSON.stringify(user)],
        ];
        if (user.branch) storageEntries.push([STORAGE_KEYS.branch, user.branch]);
        await AsyncStorage.multiSet(storageEntries);
        if (!user.branch) await AsyncStorage.multiRemove([STORAGE_KEYS.role, STORAGE_KEYS.branch]);

        dispatch({ type: 'AUTH_SUCCESS', payload: { user, token } });
        return { success: true };
      } else {
        dispatch({ type: 'AUTH_FAILURE' });
        const errorMsg = (result as any)?.error || result?.message || 'Identifiants invalides';
        return { success: false, error: errorMsg };
      }
    } catch (error) {
      console.error('Erreur de connexion:', error);
      dispatch({ type: 'AUTH_FAILURE' });
      return { success: false, error: 'Impossible de joindre le serveur' };
    }
  };

  const signup = async (payload: {
    email: string;
    password: string;
    confirmPassword: string;
    firstName: string;
    lastName: string;
    companyName: string;
    activationKey: string;
  }): Promise<{ success: boolean; message?: string }> => {
    dispatch({ type: 'AUTH_LOADING' });

    try {
      const response = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result: ApiResponse<SignupResponse> | null = await response.json().catch(() => null);

      if (response.ok && result?.success && result.data?.token && result.data?.user) {
        const token = result.data.token;
        const user = normalizeUser(result.data.user);

        await AsyncStorage.multiSet([
          [STORAGE_KEYS.token, token],
          [STORAGE_KEYS.user, JSON.stringify(user)],
        ]);
        await AsyncStorage.multiRemove([STORAGE_KEYS.role, STORAGE_KEYS.branch]);

        dispatch({ type: 'AUTH_SUCCESS', payload: { user, token } });
        return { success: true, message: result.message };
      }

      dispatch({ type: 'AUTH_FAILURE' });
      return {
        success: false,
        message: result?.message || result?.error || 'Inscription impossible',
      };
    } catch (error) {
      console.error('Erreur d’inscription:', error);
      dispatch({ type: 'AUTH_FAILURE' });
      return { success: false, message: 'Impossible de joindre le serveur' };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.token,
        STORAGE_KEYS.user,
        STORAGE_KEYS.role,
        STORAGE_KEYS.branch,
      ]);
      dispatch({ type: 'LOGOUT' });
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  const setRole = (role: UserRole) => {
    AsyncStorage.setItem(STORAGE_KEYS.role, role).catch(error => {
      console.error('Erreur lors de la sauvegarde du rôle:', error);
    });
    dispatch({ type: 'SET_ROLE', payload: role });
  };

  const setBranch = (branch: string) => {
    AsyncStorage.setItem(STORAGE_KEYS.branch, branch).catch(error => {
      console.error('Erreur lors de la sauvegarde de l\'agence:', error);
    });
    dispatch({ type: 'SET_BRANCH', payload: branch });
  };

  const hasPermission = (permission: string): boolean => {
    if (!state.user) return false;
    return state.user.permissions?.includes(permission) ?? false;
  };

  const canAccess = (screen: string): boolean => {
    if (!state.user) return false;

    // Logique d'autorisation selon le rôle
    const rolePermissions: Record<UserRole, string[]> = {
      conseiller: ['dossier.create', 'dossier.read', 'client.read'],
      caisse: ['dossier.create', 'dossier.read', 'transaction.execute'],
      referent: ['dossier.*', 'exception.validate', 'scoring.review'],
      responsable: ['*'], // Accès total
      admin: ['*'],
    };

    const effectiveRole = state.selectedRole ?? state.user.role;
    const userPermissions = rolePermissions[effectiveRole] || [];
    return userPermissions.includes('*') ||
           userPermissions.some(p => screen.startsWith(p.replace('*', '')));
  };

  const contextValue: AuthContextType = {
    ...state,
    login,
    signup,
    logout,
    setRole,
    setBranch,
    hasPermission,
    canAccess,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
}
