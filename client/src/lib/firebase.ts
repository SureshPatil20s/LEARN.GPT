import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
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
  const result: UserCredential = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  const idToken = await user.getIdToken();

  return {
    email: user.email || '',
    name: user.displayName || user.email?.split('@')[0] || 'User',
    avatarUrl: user.photoURL || undefined,
    idToken: idToken,
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


