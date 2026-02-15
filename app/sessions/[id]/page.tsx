"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const session = useQuery(api.sessions.getSession, params?.id ? { sessionId: params.id as any } : "skip");
  const freeAgents = useQuery(
    api.freeAgents.listBySession,
    params?.id ? { sessionId: params.id as any } : "skip"
  );

  if (session === undefined) {
    return <p className="text-sm text-muted-foreground">Loading session...</p>;
  }
  if (session === null) {
    return <p className="text-sm text-muted-foreground">Session not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">
          {session.day.toUpperCase()} - {session.date}
        </h1>
        <div className="flex items-center gap-3">
          <Badge>{session.spotsRemaining} spots remaining</Badge>
          <span className="text-sm text-muted-foreground">
            {session.teamCount}/{session.maxTeams} teams
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`/teams/new?session=${session._id}`}>Create a Team</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/free-agent?session=${session._id}`}>Sign Up as Free Agent</Link>
        </Button>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Registered Teams</h2>
        {session.teams.length === 0 && (
          <p className="text-sm text-muted-foreground">No teams yet for this session.</p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {session.teams.map((team) => (
            <Card key={team._id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  {team.name}
                  <Badge variant="secondary">{team.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>Captain: {team.captainName}</p>
                <p>Players: {team.members.length}</p>
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <Link href={`/teams/${team._id}`}>View Team</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Available Free Agents</h2>
        {!freeAgents && <p className="text-sm text-muted-foreground">Loading free agents...</p>}
        {freeAgents?.length === 0 && (
          <p className="text-sm text-muted-foreground">No free agents signed up yet.</p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {freeAgents?.map((agent) => (
            <Card key={agent._id}>
              <CardContent className="space-y-1 pt-4 text-sm">
                <p className="font-medium">{agent.name}</p>
                <p>{agent.email}</p>
                {agent.phone && <p>{agent.phone}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
