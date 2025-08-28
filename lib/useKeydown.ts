import { useEffect, useRef } from 'react';

const useKeydown = (key: string, callback: (e: KeyboardEvent) => void, active = true) => {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!active) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === key) {
        callbackRef.current(event);
      }
    };

    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, [key, active]);
};

export default useKeydown;
