"use client";

import { useActionState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import { supportsWebGL2 } from "@/components/glass-x/support";
import { useLoginCardInteractive } from "@/components/glass-x/login-sequence";
import SpecularButton from "@/components/specular-button/SpecularButton";
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

const LINE_COLOR = "#AA59C7";
const noSubscription = () => () => {};

/**
 * The React Bits SpecularButton as the form's submit button. It is a plain client component (its own
 * small WebGL canvas), so it works at once, independent of the glass X loading. Its edge highlight needs
 * WebGL2; without it the near-transparent glass would all but vanish, so it gets a visible border.
 */
function GoogleButton() {
  const { pending } = useFormStatus();
  const interactive = useLoginCardInteractive();
  const webgl2 = useSyncExternalStore(noSubscription, supportsWebGL2, () => true);
  return (
    <SpecularButton
      type="submit"
      size="lg"
      radius={40}
      tint="#ffffff"
      tintOpacity={0.04}
      textColor="#f5f5f5"
      lineColor={LINE_COLOR}
      baseColor="#0e1a88"
      intensity={1.1}
      idleIntensity={0.35}
      shineSize={10}
      shineFade={69}
      thickness={1.2}
      glow={1}
      followMouse
      proximity={250}
      className="w-full"
      disabled={pending}
      aria-busy={pending}
      tabIndex={interactive ? undefined : -1}
      style={webgl2 ? undefined : { border: `1px solid color-mix(in srgb, ${LINE_COLOR} 40%, transparent)` }}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <GoogleIcon />}
      {pending ? "Redirecting to Google…" : "Sign in with Google"}
    </SpecularButton>
  );
}

export function GoogleSignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signInWithGoogle, {});
  return (
    <form action={action} className="grid gap-3">
      {next && <input type="hidden" name="next" value={next} />}
      <GoogleButton />
      <FormError state={state} />
    </form>
  );
}

export function TestLoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(testLogin, {});
  const tabIndex = useLoginCardInteractive() ? undefined : -1;
  return (
    <form action={action} className="grid gap-3">
      {next && <input type="hidden" name="next" value={next} />}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <SubmitButton variant="outline" name="role" value="strategist" tabIndex={tabIndex}>
          Strategist
        </SubmitButton>
        <SubmitButton variant="outline" name="role" value="designer" tabIndex={tabIndex}>
          Designer
        </SubmitButton>
        <SubmitButton variant="outline" name="role" value="admin" tabIndex={tabIndex}>
          Admin
        </SubmitButton>
      </div>
      <FormError state={state} />
    </form>
  );
}
