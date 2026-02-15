"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@clerk/nextjs";

export default function Home() {
  const { isSignedIn } = useUser();
  const ensureUpcoming = useMutation(api.sessions.ensureUpcomingSessionsPublic);
  const sessions = useQuery(api.sessions.listUpcoming);
  const myTeams = useQuery(api.teams.listMyTeamsWithRoster);
  const [visibleWeeks, setVisibleWeeks] = useState(1);

  useEffect(() => {
    void ensureUpcoming({ weeksAhead: 6 });
  }, [ensureUpcoming]);

  const groupedSessions = useMemo(() => {
    const grouped = sessions?.reduce<Record<string, typeof sessions>>((acc, session) => {
      acc[session.weekOf] ??= [];
      acc[session.weekOf].push(session);
      return acc;
    }, {});
    if (!grouped) {
      return [];
    }
    return Object.entries(grouped)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([weekOf, weekSessions]) => ({
        weekOf,
        sessions: weekSessions.sort((a, b) => a.date.localeCompare(b.date)),
      }));
  }, [sessions]);

  const visibleSessionGroups = groupedSessions.slice(0, visibleWeeks);
  const primaryTeam = myTeams?.[0] ?? null;

  return (
    <div className="space-y-8">
      {isSignedIn && primaryTeam && (
        <section className="space-y-4 rounded-lg border p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">My Team</h2>
            <Button asChild size="sm">
              <Link href={`/teams/${primaryTeam._id}`}>Manage Team</Link>
            </Button>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-medium">{primaryTeam.name}</p>
            <p className="text-muted-foreground">
              Next Session: {primaryTeam.nextRegistration?.session?.day?.toUpperCase() ?? "N/A"} -{" "}
              {primaryTeam.nextRegistration?.session?.date ?? "Not joined yet"}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {primaryTeam.members.map((member) => (
                <Badge key={member._id} variant="secondary">
                  {member.person?.name} ({member.defaultWeeklyStatus})
                </Badge>
              ))}
            </div>
          </div>
          {myTeams && myTeams.length > 1 && (
            <p className="text-xs text-muted-foreground">
              You currently captain {myTeams.length} teams. Showing your next team here.
            </p>
          )}
        </section>
      )}

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
        <div className="space-y-6">
          {visibleSessionGroups.map((group) => (
            <section key={group.weekOf} className="space-y-3">
              <h3 className="text-base font-medium">Week of {group.weekOf}</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {group.sessions.map((session) => (
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
          ))}
        </div>
        {groupedSessions.length > visibleWeeks && (
          <Button variant="outline" onClick={() => setVisibleWeeks((count) => count + 1)}>
            Show more weeks
          </Button>
        )}
      </section>
    </div>
  );
}
