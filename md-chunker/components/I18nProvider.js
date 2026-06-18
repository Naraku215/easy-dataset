'use client';

import { useEffect, useState } from 'react';
import i18nInstance from '@/lib/i18n';
import { I18nextProvider } from 'react-i18next';

export default function I18nProvider({ children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <>{children}</>;

  return (
    <I18nextProvider i18n={i18nInstance}>
      {children}
    </I18nextProvider>
  );
}
