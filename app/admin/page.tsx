"use client";

import { useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AdminPage() {
  const { isSignedIn } = useUser();
  const sessions = useQuery(api.sessions.listUpcoming);
  const [dayFilter, setDayFilter] = useState<"all" | "tuesday" | "wednesday" | "thursday">("all");
  const [selectedSessionId, setSelectedSessionId] = useState<Id<"sessions"> | null>(null);

  const filteredSessions = useMemo(
    () => sessions?.filter((session) => dayFilter === "all" || session.day === dayFilter) ?? [],
    [sessions, dayFilter]
  );

  const activeSessionId = selectedSessionId ?? filteredSessions[0]?._id ?? null;
  const sessionDetail = useQuery(
    api.sessions.getSession,
    activeSessionId ? { sessionId: activeSessionId } : "skip"
  );
  const freeAgents = useQuery(
    api.freeAgents.listBySession,
    activeSessionId ? { sessionId: activeSessionId } : "skip"
  );

  if (!isSignedIn) {
    return <p className="text-sm text-muted-foreground">Sign in to view the admin overview.</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Admin Overview</h1>
      <div className="flex items-center gap-2">
        <label htmlFor="dayFilter" className="text-sm">
          Day:
        </label>
        <select
          id="dayFilter"
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={dayFilter}
          onChange={(event) => setDayFilter(event.target.value as typeof dayFilter)}
        >
          <option value="all">All</option>
          <option value="tuesday">Tuesday</option>
          <option value="wednesday">Wednesday</option>
          <option value="thursday">Thursday</option>
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Day</TableHead>
                <TableHead>Teams</TableHead>
                <TableHead>Open Spots</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSessions.map((session) => (
                <TableRow
                  key={session._id}
                  className="cursor-pointer"
                  onClick={() => setSelectedSessionId(session._id)}
                >
                  <TableCell>{session.date}</TableCell>
                  <TableCell>{session.day}</TableCell>
                  <TableCell>{session.teamCount}</TableCell>
                  <TableCell>{session.spotsRemaining}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {sessionDetail && (
        <Card>
          <CardHeader>
            <CardTitle>
              Teams for {sessionDetail.day.toUpperCase()} - {sessionDetail.date}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessionDetail.teams.length === 0 && (
              <p className="text-sm text-muted-foreground">No teams registered.</p>
            )}
            {sessionDetail.teams
              .filter((team): team is NonNullable<typeof team> => team !== null)
              .map((team) => (
              <div key={team._id} className="rounded border p-3 text-sm">
                <p className="font-medium">{team.name}</p>
                <p className="text-muted-foreground">
                  Captain: {team.captainName} ({team.captainEmail})
                </p>
                <Badge variant="secondary">{team.registration.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Free Agents (Selected Session)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {freeAgents?.length === 0 && <p className="text-muted-foreground">No free agents.</p>}
          {freeAgents?.map((agent) => (
            <div key={agent._id} className="rounded border p-3">
              <p className="font-medium">{agent.name}</p>
              <p>{agent.email}</p>
              {agent.phone && <p>{agent.phone}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
