'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type AdminProduct = 'iba' | 'fbs';

const STORAGE_KEY = 'admin-lms-product';

const AdminProductContext = createContext<{
  product: AdminProduct;
  setProduct: (p: AdminProduct) => void;
} | null>(null);

export function AdminProductProvider({ children }: { children: ReactNode }) {
  const [product, setProductState] = useState<AdminProduct>('iba');

  // Read the persisted choice after mount so SSR and first client render match.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'iba' || stored === 'fbs') setProductState(stored);
  }, []);

  const setProduct = (p: AdminProduct) => {
    setProductState(p);
    localStorage.setItem(STORAGE_KEY, p);
  };

  return (
    <AdminProductContext.Provider value={{ product, setProduct }}>
      {children}
    </AdminProductContext.Provider>
  );
}

/** Which admin "mode" (IBA or FBS) is currently selected — filters every LMS list screen. */
export function useAdminProduct() {
  const ctx = useContext(AdminProductContext);
  if (!ctx) throw new Error('useAdminProduct must be used within AdminProductProvider');
  return ctx;
}
