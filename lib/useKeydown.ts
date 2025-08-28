import { useEffect } from 'react';

const useKeydown = (key: string, callback: (e: KeyboardEvent) => void, active = true) => {
  useEffect(() => {
    if (!active) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === key) {
        callback(event);
      }
    };

    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, [key, callback, active]);
};

export default useKeydown;
