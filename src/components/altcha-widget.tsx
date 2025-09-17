"use client";

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import type { AltchaWidget, AltchaWidgetMethods } from '@/types/altcha';

interface AltchaWidgetProps {
  challengeUrl?: string;
  verifyUrl?: string;
  onStateChange?: (ev: Event | CustomEvent) => void;
  onVerify?: (token: string) => void;
  onError?: () => void;
  className?: string;
  debug?: boolean;
  test?: boolean;
}

export interface AltchaWidgetRef {
  value: string | null;
  reset: () => void;
}

const AltchaWidget = forwardRef<AltchaWidgetRef, AltchaWidgetProps>(({ 
  challengeUrl,
  verifyUrl,
  onStateChange,
  onVerify,
  onError,
  className = "",
  debug = false,
  test = false
}, ref) => {
  const widgetRef = useRef<AltchaWidget & AltchaWidgetMethods & HTMLElement>(null);
  const [value, setValue] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isAltchaLoaded, setIsAltchaLoaded] = useState(false);

  // Dynamically import altcha only on client side
  useEffect(() => {
    // Check if we're in browser environment
    if (typeof window === 'undefined') {
      return;
    }
    
    setIsClient(true);
    
    import('altcha').then(() => {
      setIsAltchaLoaded(true);
    }).catch((error) => {
      console.error('Failed to load AltCHA library:', error);
      setIsAltchaLoaded(false);
    });
  }, []);

  useImperativeHandle(ref, () => {
    return {
      get value() {
        return value;
      },
      reset: () => {
        if (widgetRef.current) {
          const widget = widgetRef.current as any;
          if (widget.reset) {
            widget.reset();
          }
          setValue(null);
        }
      }
    };
  }, [value]);

  useEffect(() => {
    if (!isAltchaLoaded) {
      return;
    }

    const handleStateChange = (ev: Event | CustomEvent) => {
      if ('detail' in ev) {
        const detail = (ev as CustomEvent).detail;
        if (detail.state === "verified") {
          setValue(detail.payload);
          onVerify?.(detail.payload);
        } else {
          setValue(null);
          onError?.();
        }

        onStateChange?.(ev);
      }
    };

    const handleError = () => {
      setValue(null);
      onError?.();
    };

    const { current } = widgetRef;

    if (current) {
      current.addEventListener('statechange', handleStateChange);
      current.addEventListener('altcha:error', handleError);
      
      return () => {
        current.removeEventListener('statechange', handleStateChange);
        current.removeEventListener('altcha:error', handleError);
      };
    }
  }, [isAltchaLoaded, onStateChange, onVerify, onError]);

  if (!isClient || !isAltchaLoaded) {
    return (
      <div className={`altcha-container w-full ${className}`}>
        <div className="altcha-loading flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg bg-gray-50">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"></div>
          <p className="text-sm text-gray-600">Loading security verification...</p>
        </div>
      </div>
    );
  }

  return (
      <altcha-widget
        ref={widgetRef}
        challengeurl={challengeUrl}
        verifyurl={verifyUrl}
        debug={debug}
        test={test}
        hidefooter
      />
  );
});

AltchaWidget.displayName = "AltchaWidget";

export default AltchaWidget;