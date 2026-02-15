"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, LogOut } from "lucide-react";
import { toast } from "sonner";

export default function SessionsPage() {
  const ensureUpcoming = useMutation(api.sessions.ensureUpcomingSessionsPublic);
  const leaveSession = useMutation(api.registrations.leaveSession);
  const sessions = useQuery(api.sessions.listUpcoming);
  const myTeams = useQuery(api.teams.listMyTeams);
  const myRegistrations = useQuery(api.registrations.listMyRegistrations);

  useEffect(() => {
    void ensureUpcoming({ weeksAhead: 6 });
  }, [ensureUpcoming]);

  const grouped =
    sessions?.reduce<Record<string, typeof sessions>>((acc, session) => {
      acc[session.weekOf] ??= [];
      acc[session.weekOf].push(session);
      return acc;
    }, {}) ?? {};

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Sessions</h1>
      <p className="text-sm text-muted-foreground">
        Choose a session day and create your team for that week.
      </p>

      {!sessions && <p className="text-sm text-muted-foreground">Loading sessions...</p>}

      {Object.entries(grouped).map(([weekOf, weekSessions]) => (
        <section key={weekOf} className="space-y-3">
          <h2 className="text-lg font-medium">Week of {weekOf}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {weekSessions
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((session) => (
                <Card key={session._id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base">
                      {session.day.toUpperCase()}
                      <Badge variant={session.spotsRemaining > 0 ? "default" : "secondary"}>
                        {session.spotsRemaining} left
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p>{session.date}</p>
                    <p>
                      Teams: {session.teamCount}/{session.maxTeams}
                    </p>
                    <div className="grid gap-2">
                      <Button asChild size="sm">
                        <Link href={`/sessions/${session._id}`}>View Session</Link>
                      </Button>
                      {(() => {
                        const myRegistration = myRegistrations?.find(
                          (registration) => registration.sessionId === session._id
                        );
                        if (!myRegistration) {
                          return (
                            <Button asChild size="sm" variant="outline">
                              <Link
                                href={
                                  myTeams && myTeams.length > 0
                                    ? `/sessions/${session._id}`
                                    : `/teams/new?session=${session._id}`
                                }
                              >
                                {myTeams && myTeams.length > 0 ? "Join Session" : "Create Team"}
                              </Link>
                            </Button>
                          );
                        }
                        return (
                          <Button
                            size="sm"
                            variant="outline"
                            className="group"
                            onClick={() => {
                              if (!window.confirm("Leave this session and remove your team?")) {
                                return;
                              }
                              void (async () => {
                                try {
                                  await leaveSession({ registrationId: myRegistration._id });
                                  toast.success("You left the session.");
                                } catch (error) {
                                  toast.error(
                                    error instanceof Error
                                      ? error.message
                                      : "Unable to leave session."
                                  );
                                }
                              })();
                            }}
                          >
                            <span className="flex items-center gap-1 group-hover:hidden">
                              <Check className="h-4 w-4" />
                              Joined
                            </span>
                            <span className="hidden items-center gap-1 text-destructive group-hover:flex">
                              <LogOut className="h-4 w-4" />
                              Leave session
                            </span>
                          </Button>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
