"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function TeamDetailPage() {
  const params = useParams<{ id: string }>();
  const teamId = params.id as Id<"teams">;
  const team = useQuery(api.teams.getTeam, { teamId });
  const addMember = useMutation(api.teamMembers.addMember);
  const removeMember = useMutation(api.teamMembers.removeMember);
  const updateTeam = useMutation(api.teams.updateTeam);

  const [teamName, setTeamName] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");

  if (team === undefined) {
    return <p className="text-sm text-muted-foreground">Loading team...</p>;
  }
  if (team === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Team not found, or you do not have permission to view it.
      </p>
    );
  }

  const inviteBase = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{team.name}</h1>
        <p className="text-sm text-muted-foreground">
          Session: {team.session?.day.toUpperCase()} - {team.session?.date}
        </p>
        <Badge variant="secondary">{team.status}</Badge>
      </div>

      {team.canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Rename Team</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              placeholder={team.name}
            />
            <Button
              onClick={() => {
                void (async () => {
                  try {
                    await updateTeam({ teamId, teamName: teamName || team.name });
                    toast.success("Team updated.");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Unable to update team.");
                  }
                })();
              }}
            >
              Save
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Roster</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {team.members.map((member) => (
            <div
              key={member._id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {member.name} {member.role === "captain" ? "(Captain)" : ""}
                </p>
                <p className="text-muted-foreground">{member.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{member.status}</Badge>
                {team.canManage && member.inviteToken && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void (async () => {
                        await navigator.clipboard.writeText(`${inviteBase}/invite/${member.inviteToken}`);
                        toast.success("Invite link copied.");
                      })();
                    }}
                  >
                    Copy Invite
                  </Button>
                )}
                {team.canManage && member.role !== "captain" && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      void (async () => {
                        try {
                          await removeMember({ teamId, memberId: member._id });
                          toast.success("Member removed.");
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Unable to remove member.");
                        }
                      })();
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {team.canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Add Player</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Name" />
            <Input
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder="Email"
              type="email"
            />
            <Button
              onClick={() => {
                void (async () => {
                  try {
                    await addMember({ teamId, name: newName, email: newEmail });
                    setNewName("");
                    setNewEmail("");
                    toast.success("Invite sent.");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Unable to add member.");
                  }
                })();
              }}
            >
              Add
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
