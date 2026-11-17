import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  UserCredential,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDWsWDpEC-OtNGgK8c6xLlFIPVzwU5BzUg",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "sureshgpt-1334e.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "sureshgpt-1334e",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "sureshgpt-1334e.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "528536100554",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:528536100554:web:9baaec4c7bf26321249e33",
};

// Initialize Firebase safely (avoid re-initialization in Next.js hot reload)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Prompt account selection every time
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export async function signInWithGooglePopup(): Promise<{
  email: string;
  name: string;
  avatarUrl?: string;
  idToken?: string;
}> {
  try {
    // Try popup first (best UX)
    const result: UserCredential = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const idToken = await user.getIdToken();
    return {
      email: user.email || '',
      name: user.displayName || user.email?.split('@')[0] || 'User',
      avatarUrl: user.photoURL || undefined,
      idToken,
    };
  } catch (err: any) {
    if (err?.code === 'auth/popup-blocked') {
      // Popup was blocked by browser — fall back to redirect flow
      await signInWithRedirect(auth, googleProvider);
      // Page will reload; result is handled by getGoogleRedirectResult() on mount
      return { email: '', name: '' }; // unreachable after redirect
    }
    throw err;
  }
}

/**
 * Call this once on app mount to pick up the result of a redirect sign-in.
 * Returns null if there is no pending redirect result.
 */
export async function getGoogleRedirectResult(): Promise<{
  email: string;
  name: string;
  avatarUrl?: string;
  idToken?: string;
} | null> {
  const result = await getRedirectResult(auth);
  if (!result) return null;
  const user = result.user;
  const idToken = await user.getIdToken();
  return {
    email: user.email || '',
    name: user.displayName || user.email?.split('@')[0] || 'User',
    avatarUrl: user.photoURL || undefined,
    idToken,
  };
}

export async function signInWithFirebaseEmail(email: string, pass: string): Promise<{
  email: string;
  name: string;
  idToken: string;
}> {
  const result: UserCredential = await signInWithEmailAndPassword(auth, email, pass);
  const user = result.user;
  const idToken = await user.getIdToken();

  return {
    email: user.email || '',
    name: user.displayName || user.email?.split('@')[0] || 'User',
    idToken,
  };
}

export async function signUpWithFirebaseEmail(email: string, pass: string, name: string): Promise<{
  email: string;
  name: string;
  idToken: string;
}> {
  const result: UserCredential = await createUserWithEmailAndPassword(auth, email, pass);
  const user = result.user;
  if (name.trim()) {
    try {
      await updateProfile(user, { displayName: name.trim() });
    } catch {}
  }
  const idToken = await user.getIdToken();

  return {
    email: user.email || '',
    name: name.trim() || user.email?.split('@')[0] || 'User',
    idToken,
  };
}


