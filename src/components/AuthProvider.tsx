"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { auth, isAuthConfigured } from "@/lib/firebase";
import { authErrorMessage, handleGoogleRedirect } from "@/lib/auth-api";
import { useAppStore } from "@/store/useAppStore";

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; user: AuthUser };

interface AuthContextValue {
  state: AuthState;
  /** Friendly message for a failed Google redirect sign-in, if one just
   *  happened on this page load (e.g. unauthorized domain). */
  redirectError: string | null;
  clearRedirectError: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  state: { status: "loading" },
  redirectError: null,
  clearRedirectError: () => {},
});

function mapUser(fb: FirebaseUser): AuthUser {
  return {
    uid: fb.uid,
    email: fb.email,
    displayName: fb.displayName,
    photoURL: fb.photoURL,
  };
}

const LOCAL_USER: AuthUser = {
  uid: "local-user",
  email: null,
  displayName: null,
  photoURL: null,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Without Firebase keys the app runs on one device-local account, decided
  // during the very first render (not in an effect) so SSR/hydration agree.
  const [state, setState] = useState<AuthState>(() =>
    !isAuthConfigured() || !auth
      ? { status: "signedIn", user: LOCAL_USER }
      : { status: "loading" },
  );
  const [redirectError, setRedirectError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthConfigured() || !auth) return;
    // Complete a pending Google redirect sign-in (the page just came back
    // from Google's consent screen). Failures here were previously invisible
    // — the user was silently dropped back on the sign-in form — so surface
    // them as a friendly message on the auth page.
    void handleGoogleRedirect().then(({ error }) => {
      if (error) {
        console.warn("Google redirect sign-in failed:", error);
        setRedirectError(authErrorMessage(error));
      }
    });
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setState(
        fbUser
          ? { status: "signedIn", user: mapUser(fbUser) }
          : { status: "signedOut" },
      );
    });
    return unsubscribe;
  }, []);

  // Mirror the signed-in user into the per-user data store.
  const signInAs = useAppStore((s) => s.signInAs);
  const signOutUser = useAppStore((s) => s.signOutUser);
  useEffect(() => {
    if (state.status === "signedIn") {
      signInAs(state.user.uid);
    } else if (state.status === "signedOut") {
      signOutUser();
    }
  }, [state, signInAs, signOutUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      redirectError,
      clearRedirectError: () => setRedirectError(null),
    }),
    [state, redirectError],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext).state;
}

/** Friendly message for a failed Google redirect sign-in on this load. */
export function useAuthError(): string | null {
  return useContext(AuthContext).redirectError;
}

export function useClearAuthError(): () => void {
  return useContext(AuthContext).clearRedirectError;
}
