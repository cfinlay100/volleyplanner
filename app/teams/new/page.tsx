"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const createTeamSchema = z.object({
  teamName: z.string().min(2, "Team name is required."),
  sessionId: z.string().min(1, "Select a session."),
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

export default function NewTeamPage() {
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

  const selectedPlayers = useMemo(
    () => players.filter((player) => player.name.trim() || player.email.trim()),
    [players]
  );

  useEffect(() => {
    void ensureUpcoming({ weeksAhead: 6 });
  }, [ensureUpcoming]);

  async function onSubmit() {
    const parsed = createTeamSchema.safeParse({
      teamName,
      sessionId,
      players: selectedPlayers,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid team details.");
      return;
    }

    try {
      const teamId = await createTeam({
        teamName: parsed.data.teamName,
        sessionId: parsed.data.sessionId as Id<"sessions">,
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
              <Button onClick={() => setStep(2)}>Continue</Button>
            </>
          )}

          {step === 2 && (
            <>
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
                <Button onClick={() => void onSubmit()}>Create Team</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
