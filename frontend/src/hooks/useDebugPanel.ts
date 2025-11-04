import { useState, useCallback } from 'react';

interface UseDebugPanelReturn {
  isVisible: boolean;
  toggle: () => void;
  show: () => void;
  hide: () => void;
}

export const useDebugPanel = (): UseDebugPanelReturn => {
  const [isVisible, setIsVisible] = useState(false);

  const toggle = useCallback(() => {
    setIsVisible(prev => !prev);
  }, []);

  const show = useCallback(() => {
    setIsVisible(true);
  }, []);

  const hide = useCallback(() => {
    setIsVisible(false);
  }, []);

  return {
    isVisible,
    toggle,
    show,
    hide,
  };
};






























