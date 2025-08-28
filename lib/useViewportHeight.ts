import { useEffect, useRef } from 'react';

const useViewportHeight = () => {
  const vhRef = useRef<number>(typeof window !== 'undefined' ? window.innerHeight * 0.01 : 0);

  useEffect(() => {
    const setDynamicVh = () => {
      const vv = window.visualViewport;
      const height = vv ? vv.height : window.innerHeight;
      const newVh = height * 0.01;
      document.documentElement.style.setProperty('--vh', `${newVh}px`);
      if (vv) {
        const keyboard = window.innerHeight - vv.height - vv.offsetTop;
        document.documentElement.style.setProperty('--keyboard-height', `${keyboard}px`);
      }
      vhRef.current = newVh;
    };

    let timeoutId: ReturnType<typeof setTimeout>;
    const debouncedSetDynamicVh = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(setDynamicVh, 100);
    };

    setDynamicVh();

    window.addEventListener('resize', debouncedSetDynamicVh);
    window.visualViewport?.addEventListener('resize', debouncedSetDynamicVh);
    return () => {
      window.removeEventListener('resize', debouncedSetDynamicVh);
      window.visualViewport?.removeEventListener('resize', debouncedSetDynamicVh);
      clearTimeout(timeoutId);
    };
  }, []);

  return vhRef;
};

export default useViewportHeight;
