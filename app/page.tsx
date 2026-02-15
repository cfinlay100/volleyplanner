"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const ensureUpcoming = useMutation(api.sessions.ensureUpcomingSessionsPublic);
  const sessions = useQuery(api.sessions.listUpcoming);

  useEffect(() => {
    void ensureUpcoming({ weeksAhead: 6 });
  }, [ensureUpcoming]);

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-lg border p-6">
        <h1 className="text-3xl font-bold tracking-tight">Volleyball Tournament Signups</h1>
        <p className="text-muted-foreground">
          Captains create teams, invite players, and reserve a session on Tuesday,
          Wednesday, or Thursday. Each session supports up to 24 teams across 12 courts.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/sessions">Browse Sessions</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/teams/new">Create Team</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/free-agent">Join as Free Agent</Link>
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Upcoming Session Availability</h2>
        {!sessions && <p className="text-sm text-muted-foreground">Loading sessions...</p>}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sessions?.slice(0, 6).map((session) => (
            <Card key={session._id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{session.day.toUpperCase()}</span>
                  <Badge variant={session.spotsRemaining > 0 ? "default" : "secondary"}>
                    {session.spotsRemaining} spots left
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>Date: {session.date}</p>
                <p>
                  Teams: {session.teamCount} / {session.maxTeams}
                </p>
                <Button asChild size="sm" className="w-full">
                  <Link href={`/sessions/${session._id}`}>View Session</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
