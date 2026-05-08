'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const STORAGE_KEY = 'cta-active-client';

interface ActiveClientContextValue {
  activeClientId: string | null;
  setActiveClient: (clientId: string | null) => void;
}

export const ActiveClientContext = createContext<ActiveClientContextValue>({
  activeClientId: null,
  setActiveClient: () => {},
});

export function ActiveClientProvider({ children }: { children: React.ReactNode }) {
  const [activeClientId, setActiveClientId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) ?? null;
    }
    return null;
  });

  useEffect(() => {
    if (activeClientId) {
      localStorage.setItem(STORAGE_KEY, activeClientId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [activeClientId]);

  return (
    <ActiveClientContext.Provider
      value={{ activeClientId, setActiveClient: setActiveClientId }}
    >
      {children}
    </ActiveClientContext.Provider>
  );
}

export function useActiveClient() {
  return useContext(ActiveClientContext);
}
