import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Sign-in problem · UXDA Learn" };

const MESSAGES: Record<string, { title: string; body: string }> = {
  domain: {
    title: "This account can't be used here",
    body: "UXDA Learn is only for UXDA team members. Please sign in with your @theuxda.com Google account.",
  },
  profile: {
    title: "Your profile isn't ready",
    body: "We couldn't find your profile. Try signing in again — if it keeps happening, let Alvis know.",
  },
  missing_code: {
    title: "Sign-in didn't complete",
    body: "The sign-in link was incomplete or has expired. Please try again.",
  },
  oauth: {
    title: "Sign-in didn't complete",
    body: "Something went wrong while signing you in. Please try again.",
  },
};

export default async function AuthErrorPage({ searchParams }: PageProps<"/auth/error">) {
  const reason = (await searchParams).reason;
  const message = MESSAGES[typeof reason === "string" ? reason : ""] ?? MESSAGES.oauth;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <ShieldAlert className="text-muted-foreground mx-auto mb-2 size-8" aria-hidden />
          <CardTitle className="text-xl">
            <h1>{message.title}</h1>
          </CardTitle>
          <CardDescription>{message.body}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
