"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const registerTeamForSession = useMutation(api.registrations.registerTeamForSession);
  const updateRegistrationMembers = useMutation(api.registrations.updateRegistrationMembers);
  const leaveSession = useMutation(api.registrations.leaveSession);
  const myTeams = useQuery(api.teams.listMyTeams);
  const myTeamsWithRoster = useQuery(api.teams.listMyTeamsWithRoster);
  const myRegistrations = useQuery(api.registrations.listMyRegistrations);
  const session = useQuery(api.sessions.getSession, params?.id ? { sessionId: params.id as any } : "skip");
  const freeAgents = useQuery(
    api.freeAgents.listBySession,
    params?.id ? { sessionId: params.id as any } : "skip"
  );
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [memberSelections, setMemberSelections] = useState<Record<string, "active" | "inactive" | "not_invited">>({});
  const sessionId = session?._id;
  const myRegistrationInSession = myRegistrations?.find(
    (registration) => registration.sessionId === sessionId
  );
  const selectedTeam = useMemo(
    () => myTeamsWithRoster?.find((team) => team._id === selectedTeamId) ?? myTeamsWithRoster?.[0],
    [myTeamsWithRoster, selectedTeamId]
  );
  const selectedTeamRegistration = useQuery(
    api.registrations.getRegistrationForTeamAndSession,
    selectedTeam && sessionId ? { teamId: selectedTeam._id, sessionId } : "skip"
  );
  const selectedTeamRoster = selectedTeam?.members ?? [];

  const registrationMemberMap = useMemo(() => {
    const map: Record<string, "active" | "inactive" | "not_invited"> = {};
    if (selectedTeamRegistration?.members) {
      for (const member of selectedTeamRegistration.members) {
        map[member.personId] = member.weeklyStatus;
      }
    }
    return map;
  }, [selectedTeamRegistration]);

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
        {!myRegistrationInSession ? (
          <>
            {(!myTeams || myTeams.length === 0) && (
              <Button asChild>
                <Link href={`/teams/new?session=${session._id}`}>Create a Team</Link>
              </Button>
            )}
            {myTeams && myTeams.length > 0 && (
              <Button
                onClick={() => {
                  if (!selectedTeam) {
                    toast.error("Select a team first.");
                    return;
                  }
                  const selections = selectedTeamRoster.map((member) => ({
                    personId: member.personId as Id<"people">,
                    weeklyStatus:
                      memberSelections[member.personId] ??
                      member.defaultWeeklyStatus,
                  }));
                  void (async () => {
                    try {
                      await registerTeamForSession({
                        teamId: selectedTeam._id,
                        sessionId: session._id,
                        memberSelections: selections,
                      });
                      toast.success("Team joined this session.");
                    } catch (error) {
                      toast.error(
                        error instanceof Error ? error.message : "Unable to join session."
                      );
                    }
                  })();
                }}
              >
                Join Session
              </Button>
            )}
          </>
        ) : (
          <Button
            variant="outline"
            className="group"
            onClick={() => {
              if (!window.confirm("Leave this session and remove your team?")) {
                return;
              }
              void (async () => {
                try {
                  await leaveSession({ registrationId: myRegistrationInSession._id });
                  toast.success("You left the session.");
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Unable to leave session."
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
        )}
        <Button asChild variant="outline">
          <Link href={`/free-agent?session=${session._id}`}>Sign Up as Free Agent</Link>
        </Button>
      </div>

      {myTeamsWithRoster && myTeamsWithRoster.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Weekly Member Selection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-1">
              <label htmlFor="teamSelect" className="text-sm font-medium">
                Team
              </label>
              <select
                id="teamSelect"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={selectedTeam?._id ?? ""}
                onChange={(event) => setSelectedTeamId(event.target.value)}
              >
                {myTeamsWithRoster.map((team) => (
                  <option key={team._id} value={team._id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedTeamRoster.map((member) => (
              <div key={member._id} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded border p-2">
                <div>
                  <p className="font-medium">{member.person?.name}</p>
                  <p className="text-xs text-muted-foreground">{member.person?.email}</p>
                </div>
                <select
                  className="rounded-md border bg-background px-2 py-1 text-xs"
                  value={
                    selectedTeamRegistration
                      ? registrationMemberMap[member.personId] ?? member.defaultWeeklyStatus
                      : memberSelections[member.personId] ?? member.defaultWeeklyStatus
                  }
                  onChange={(event) => {
                    const value = event.target.value as "active" | "inactive" | "not_invited";
                    if (selectedTeamRegistration) {
                      const next = { ...registrationMemberMap, [member.personId]: value };
                      void (async () => {
                        try {
                          await updateRegistrationMembers({
                            registrationId: selectedTeamRegistration._id,
                            memberSelections: selectedTeamRoster.map((rosterMember) => ({
                              personId: rosterMember.personId,
                              weeklyStatus:
                                next[rosterMember.personId] ?? rosterMember.defaultWeeklyStatus,
                            })),
                          });
                          toast.success("Weekly statuses updated.");
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Unable to update weekly statuses."
                          );
                        }
                      })();
                    } else {
                      setMemberSelections((prev) => ({ ...prev, [member.personId]: value }));
                    }
                  }}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="not_invited">Not invited</option>
                </select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Registered Teams</h2>
        {session.teams.length === 0 && (
          <p className="text-sm text-muted-foreground">No teams yet for this session.</p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {session.teams
            .filter((team): team is NonNullable<typeof team> => team !== null)
            .map((team) => (
            <Card key={team._id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  {team.name}
                  <Badge variant="secondary">{team.registration.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>Captain: {team.captainName}</p>
                <p>Players: {team.members.filter((member) => member.weeklyStatus === "active").length} active</p>
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
