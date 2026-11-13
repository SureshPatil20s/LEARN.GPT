'use client';

/**
 * GoogleOAuthWrapper
 * Wraps the app with GoogleOAuthProvider so @react-oauth/google works throughout.
 * When NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set, renders children without the provider
 * (Google sign-in button will show a setup notice instead).
 */
import { GoogleOAuthProvider } from '@react-oauth/google';

export default function GoogleOAuthWrapper({ children }: { children: React.ReactNode }) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    // No Client ID configured — render without provider (Google button shows notice)
    return <>{children}</>;
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      {children}
    </GoogleOAuthProvider>
  );
}

