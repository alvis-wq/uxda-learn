import type { Metadata } from "next";
import { FlaskConical } from "lucide-react";
import { STAGE_BACKGROUND } from "@/components/glass-x/constants";
import { GlassX } from "@/components/glass-x/glass-x";
import { UxdaLogo } from "@/components/uxda-logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNext } from "@/lib/auth/paths";
import { isTestLoginEnabled } from "@/lib/auth/test-login";
import { GoogleSignInForm, TestLoginForm } from "./login-forms";

export const metadata: Metadata = { title: "Sign in · UXDA Learn" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const raw = (await searchParams).next;
  const next = safeNext(typeof raw === "string" ? raw : undefined);
  const nextParam = next === "/" ? undefined : next;

  return (
    // Always the dark stage, also in light mode (`dark` re-themes the cards to match).
    <main
      className="dark text-foreground isolate flex flex-1 flex-col items-center justify-center gap-4 overflow-hidden px-4 py-10"
      style={{ backgroundColor: STAGE_BACKGROUND }}
    >
      <GlassX className="w-[min(88vw,46vh,480px)]" />
      <div className="stage-card-in grid w-full max-w-sm gap-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              {/* Same lockup as the header: logo + "Learn". The logo's label names the heading. */}
              <h1 className="flex items-center justify-center gap-2.5 font-semibold">
                <UxdaLogo className="h-7 w-auto" />
                <span aria-hidden>Learn</span>
              </h1>
            </CardTitle>
            <CardDescription>Sign in with your UXDA Google account.</CardDescription>
          </CardHeader>
          <CardContent>
            <GoogleSignInForm next={nextParam} />
          </CardContent>
        </Card>

        {isTestLoginEnabled() && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <FlaskConical className="size-4" aria-hidden />
                Test login
              </CardTitle>
              <CardDescription>Development only. Signs in as a test user.</CardDescription>
            </CardHeader>
            <CardContent>
              <TestLoginForm next={nextParam} />
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
