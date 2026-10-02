import React, { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((msg) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[2000] flex flex-col gap-2 w-[min(380px,90vw)]">
        {toasts.map(t => (
          <div key={t.id} className="bg-asphalt text-concrete rounded-md px-4 py-3 text-sm shadow-lg border-l-4 border-signal-yellow animate-[fadein_.25s_ease]">
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
