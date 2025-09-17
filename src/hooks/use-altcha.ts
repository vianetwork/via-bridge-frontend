import { useState, useCallback } from "react";

interface AltchaState {
  token: string | null;
  isVerified: boolean;
  hasError: boolean;
  isLoading: boolean;
}

export function useAltcha() {
  const [altchaState, setAltchaState] = useState<AltchaState>({
    token: null,
    isVerified: false,
    hasError: false,
    isLoading: false,
  });

  const handleVerify = useCallback(() => {
    setAltchaState(prev => {
      const newState = {
        ...prev,
        token: null,
        isVerified: true,
        hasError: false,
        isLoading: false,
      };
      return newState;
    });
  }, []);

  const handleError = useCallback(() => {
    setAltchaState(prev => ({
      ...prev,
      token: null,
      isVerified: false,
      hasError: true,
      isLoading: false,
    }));
  }, []);

  const handleLoading = useCallback(() => {
    setAltchaState(prev => ({
      ...prev,
      isLoading: true,
      hasError: false,
    }));
  }, []);

  const resetAltcha = useCallback(() => {
    setAltchaState({
      token: null,
      isVerified: false,
      hasError: false,
      isLoading: false,
    });
  }, []);

  return {
    altchaState,
    handleVerify,
    handleError,
    handleLoading,
    resetAltcha,
  };
}
