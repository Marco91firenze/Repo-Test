import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface UserProfile {
  id: string;
  company_name: string;
  email: string;
  credits_remaining: number;
  total_cvs_selected: number;
}

interface UserContextType {
  user: UserProfile | null;
  loading: boolean;
  createProfile: (companyName: string, email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  syncPurchases: () => Promise<number>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const result = await (window as any).electronAPI?.getUserProfile();
      if (result?.success && result.data) {
        setUser(result.data);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const createProfile = async (companyName: string, email: string) => {
    const id = crypto.randomUUID();
    const result = await (window as any).electronAPI?.createUserProfile({
      id,
      company_name: companyName,
      email,
    });
    if (result?.success && result.data) {
      setUser(result.data);
    } else {
      throw new Error(result?.error || 'Failed to create profile');
    }
  };

  const refreshProfile = async () => {
    await loadProfile();
  };

  const syncPurchases = async (): Promise<number> => {
    try {
      const result = await (window as any).electronAPI?.syncPurchases();
      if (result?.success) {
        await loadProfile();
        return result.data?.new_credits || 0;
      }
      return 0;
    } catch {
      return 0;
    }
  };

  return (
    <UserContext.Provider value={{ user, loading, createProfile, refreshProfile, syncPurchases }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
