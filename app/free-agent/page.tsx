"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function FreeAgentPageContent() {
  const searchParams = useSearchParams();
  const initialSession = searchParams.get("session") ?? "";
  const sessions = useQuery(api.sessions.listUpcoming);
  const ensureUpcoming = useMutation(api.sessions.ensureUpcomingSessionsPublic);
  const signUp = useMutation(api.freeAgents.signUp);

  const [sessionId, setSessionId] = useState(initialSession);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    void ensureUpcoming({ weeksAhead: 6 });
  }, [ensureUpcoming]);

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Sign Up as a Free Agent</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="session">Session</Label>
          <select
            id="session"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={sessionId}
            onChange={(event) => setSessionId(event.target.value)}
          >
            <option value="">Select a session</option>
            {sessions?.map((session) => (
              <option key={session._id} value={session._id}>
                {session.day.toUpperCase()} - {session.date}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </div>
        <Button
          onClick={() => {
            void (async () => {
            try {
              await signUp({
                sessionId: sessionId as Id<"sessions">,
                name,
                email,
                phone: phone || undefined,
              });
              toast.success("Signed up as a free agent.");
              setName("");
              setEmail("");
              setPhone("");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Unable to sign up.");
            }
            })();
          }}
          className="w-full"
        >
          Submit
        </Button>
      </CardContent>
    </Card>
  );
}

export default function FreeAgentPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading form...</div>}>
      <FreeAgentPageContent />
    </Suspense>
  );
}
