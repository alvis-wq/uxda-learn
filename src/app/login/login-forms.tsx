"use client";

import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { signInWithGoogle, testLogin, type LoginState } from "./actions";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8l4-3z" />
      <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
    </svg>
  );
}

function FormError({ state }: { state: LoginState }) {
  if (!state.error) return null;
  return (
    <Alert variant="destructive">
      <AlertCircle aria-hidden />
      <AlertDescription>{state.error}</AlertDescription>
    </Alert>
  );
}

export function GoogleSignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signInWithGoogle, {});
  return (
    <form action={action} className="grid gap-3">
      {next && <input type="hidden" name="next" value={next} />}
      <SubmitButton size="lg" className="w-full" pendingLabel="Redirecting to Google…">
        <GoogleIcon />
        Sign in with Google
      </SubmitButton>
      <FormError state={state} />
    </form>
  );
}

export function TestLoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(testLogin, {});
  return (
    <form action={action} className="grid gap-3">
      {next && <input type="hidden" name="next" value={next} />}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <SubmitButton variant="outline" name="role" value="strategist">
          Strategist
        </SubmitButton>
        <SubmitButton variant="outline" name="role" value="designer">
          Designer
        </SubmitButton>
        <SubmitButton variant="outline" name="role" value="admin">
          Admin
        </SubmitButton>
      </div>
      <FormError state={state} />
    </form>
  );
}
