import { useEffect, useState } from 'react';

const useViewportHeight = () => {
  const [vh, setVh] = useState(typeof window !== 'undefined' ? window.innerHeight * 0.01 : 0);

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
      setVh(newVh);
    };

    setDynamicVh();

    window.addEventListener('resize', setDynamicVh);
    window.visualViewport?.addEventListener('resize', setDynamicVh);
    return () => {
      window.removeEventListener('resize', setDynamicVh);
      window.visualViewport?.removeEventListener('resize', setDynamicVh);
    };
  }, []);

  return vh;
};

export default useViewportHeight;
