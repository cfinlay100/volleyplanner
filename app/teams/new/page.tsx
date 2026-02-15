"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SignInButton, SignedIn, SignedOut, useUser } from "@clerk/nextjs";
import { z } from "zod";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const createTeamSchema = z.object({
  teamName: z.string().min(2, "Team name is required."),
  sessionId: z.string().optional(),
  registerNow: z.boolean(),
  players: z
    .array(
      z.object({
        name: z.string().min(1, "Player name required."),
        email: z.email("Valid player email required."),
      })
    )
    .min(2, "Add at least 2 players.")
    .max(3, "Add up to 3 players."),
});

function NewTeamPageContent() {
  const { user } = useUser();
  const { isAuthenticated: isConvexAuthenticated, isLoading: isConvexAuthLoading } =
    useConvexAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSession = searchParams.get("session") ?? "";

  const sessions = useQuery(api.sessions.listUpcoming);
  const ensureUpcoming = useMutation(api.sessions.ensureUpcomingSessionsPublic);
  const createTeam = useMutation(api.teams.createTeam);

  const [step, setStep] = useState(1);
  const [teamName, setTeamName] = useState("");
  const [sessionId, setSessionId] = useState(initialSession);
  const [players, setPlayers] = useState([
    { name: "", email: "" },
    { name: "", email: "" },
    { name: "", email: "" },
  ]);
  const [registerNow, setRegisterNow] = useState(true);

  const selectedPlayers = useMemo(
    () => players.filter((player) => player.name.trim() || player.email.trim()),
    [players]
  );

  useEffect(() => {
    void ensureUpcoming({ weeksAhead: 6 });
  }, [ensureUpcoming]);

  async function onSubmit() {
    if (!isConvexAuthenticated) {
      toast.error("Auth is still syncing. Please wait a moment and try again.");
      return;
    }

    const parsed = createTeamSchema.safeParse({
      teamName,
      sessionId: sessionId || undefined,
      registerNow,
      players: selectedPlayers,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid team details.");
      return;
    }
    if (parsed.data.registerNow && !parsed.data.sessionId) {
      toast.error("Select a session if you want to register now.");
      return;
    }

    try {
      const teamId = await createTeam({
        teamName: parsed.data.teamName,
        sessionId:
          parsed.data.registerNow && parsed.data.sessionId
            ? (parsed.data.sessionId as Id<"sessions">)
            : undefined,
        players: parsed.data.players,
      });
      toast.success("Team created.");
      router.push(`/teams/${teamId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create team.");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Create Team</h1>
      <SignedOut>
        <Card>
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You must be signed in to create a team and send invites.
            </p>
            <SignInButton mode="modal">
              <Button>Sign in to continue</Button>
            </SignInButton>
          </CardContent>
        </Card>
      </SignedOut>

      <SignedIn>
        {isConvexAuthLoading && (
          <Card>
            <CardHeader>
              <CardTitle>Finishing sign-in...</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Please wait while we finish connecting your account to tournament signup.
              </p>
            </CardContent>
          </Card>
        )}
        {!isConvexAuthLoading && !isConvexAuthenticated && (
          <Card>
            <CardHeader>
              <CardTitle>Signed in, but backend auth is unavailable</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your Clerk session is active, but Convex did not receive an auth token yet.
                Refresh the page. If it persists, verify the Clerk JWT template named
                <code className="mx-1 rounded bg-muted px-1 py-0.5">convex</code>
                is configured for this environment.
              </p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Step {step} of 2</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="teamName">Team Name</Label>
                  <Input
                    id="teamName"
                    value={teamName}
                    onChange={(event) => setTeamName(event.target.value)}
                    placeholder="Sunset Spikers"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sessionId">Session</Label>
                  <select
                    id="sessionId"
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
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={registerNow}
                    onChange={(event) => setRegisterNow(event.target.checked)}
                  />
                  Register this team in the selected session now
                </label>
                <Button onClick={() => setStep(2)}>Continue</Button>
              </>
            )}

            {step === 2 && (
              <>
                <h3 className="text-base font-medium">{teamName || "Team"}</h3>
                <div className="space-y-3 rounded-md border p-4">
                  <h3 className="text-sm font-medium">Captain Details</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Captain</Label>
                      <Input
                        value={user?.fullName || user?.firstName || "Signed in user"}
                        readOnly
                        disabled
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Captain Email</Label>
                      <Input
                        value={user?.primaryEmailAddress?.emailAddress || "No email on account"}
                        readOnly
                        disabled
                      />
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Add 2 or 3 invited players. The captain is added automatically.
                </p>
                {players.map((player, index) => (
                  <div key={index} className="grid gap-2 md:grid-cols-2">
                    <Input
                      value={player.name}
                      onChange={(event) => {
                        const next = [...players];
                        next[index].name = event.target.value;
                        setPlayers(next);
                      }}
                      placeholder={`Player ${index + 1} name`}
                    />
                    <Input
                      value={player.email}
                      onChange={(event) => {
                        const next = [...players];
                        next[index].email = event.target.value;
                        setPlayers(next);
                      }}
                      placeholder={`Player ${index + 1} email`}
                      type="email"
                    />
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button
                    onClick={() => void onSubmit()}
                    disabled={!isConvexAuthenticated}
                  >
                    Create Team
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </SignedIn>
    </div>
  );
}

export default function NewTeamPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading team form...</div>}>
      <NewTeamPageContent />
    </Suspense>
  );
}
