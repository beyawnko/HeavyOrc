import { useState, useRef, useCallback, useEffect } from 'react';

export interface ComponentSize {
  width: number;
  height: number;
}

const useComponentSize = <T extends HTMLElement>() => {
  const observerRef = useRef<ResizeObserver>();
  const [size, setSize] = useState<ComponentSize>({ width: 0, height: 0 });

  const ref = useCallback((node: T | null) => {
    observerRef.current?.disconnect();

    if (node && typeof ResizeObserver !== 'undefined') {
      observerRef.current = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          const { width, height } = entry.contentRect;
          setSize({ width, height });
        }
      });
      observerRef.current.observe(node);
    }
  }, []);

  useEffect(() => {
    return () => observerRef.current?.disconnect();
  }, []);

  return [ref, size] as const;
};

export default useComponentSize;
