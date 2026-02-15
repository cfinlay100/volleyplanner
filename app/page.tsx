"use client";

import { Button } from "@/components/ui/button";
import {
  Authenticated,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react";
import { api } from "@/convex/_generated/api";
import { Code } from "@/components/typography/code";
import { Link } from "@/components/typography/link";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { StickyHeader } from "@/components/layout/sticky-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  return (
    <>
      <StickyHeader className="flex justify-between items-center px-4 py-2">
        <h1 className="font-semibold">Convex + Next.js + Clerk</h1>
        <div className="flex gap-2 items-center">
          <Authenticated>
            <UserButton />
          </Authenticated>
          <Unauthenticated>
            <SignInButton mode="modal">
              <Button variant="ghost">Sign in</Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button>Sign up</Button>
            </SignUpButton>
          </Unauthenticated>
        </div>
      </StickyHeader>

      <main className="container py-8 space-y-8">
        <h2 className="text-2xl font-bold">Convex + Next.js + Clerk Auth</h2>

        <Unauthenticated>
          <p>Click one of the buttons in the top right corner to sign in.</p>
        </Unauthenticated>

        <Authenticated>
          <SignedInContent />
        </Authenticated>
      </main>
    </>
  );
}

function SignedInContent() {
  const { viewer, numbers } =
    useQuery(api.myFunctions.listNumbers, { count: 10 }) ?? {};
  const addNumber = useMutation(api.myFunctions.addNumber);

  if (viewer === undefined || numbers === undefined) {
    return (
      <>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-20 w-full" />
      </>
    );
  }

  return (
    <>
      <p>Welcome {viewer ?? "N/A"}!</p>
      <p>
        Click the button below and open this page in another window - this data
        is persisted in the Convex cloud database!
      </p>
      <Button onClick={() => addNumber({ value: Math.floor(Math.random() * 10) })}>
        Add a random number
      </Button>
      <p>
        Numbers:{" "}
        {numbers?.length === 0
          ? "Click the button!"
          : numbers?.join(", ") ?? "..."}
      </p>
      <p>
        Edit <Code>convex/myFunctions.ts</Code> to change your backend
      </p>
      <p>
        Edit <Code>app/page.tsx</Code> to change your frontend
      </p>
      <p>
        Check out{" "}
        <Link href="https://docs.convex.dev" target="_blank" rel="noopener">
          Convex docs
        </Link>
      </p>
    </>
  );
}
