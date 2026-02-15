"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const myTeams = useQuery(api.teams.listMyTeams);
  const pendingInvites = useQuery(api.teamMembers.listMyPendingInvites);
  const memberships = useQuery(api.teamMembers.listMyMemberships);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">My Teams (Captain)</h2>
        {!myTeams && <p className="text-sm text-muted-foreground">Loading...</p>}
        {myTeams?.length === 0 && <p className="text-sm text-muted-foreground">You have not created a team yet.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {myTeams?.map((team) => (
            <Card key={team._id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  {team.name}
                  <Badge variant="secondary">{team.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button asChild size="sm">
                  <Link href={`/teams/${team._id}`}>Manage Team</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Pending Invites</h2>
        {pendingInvites?.length === 0 && (
          <p className="text-sm text-muted-foreground">No pending invites.</p>
        )}
        <div className="space-y-2">
          {pendingInvites?.map((invite) => (
            <div key={invite._id} className="rounded border p-3 text-sm">
              <p>{invite.name}</p>
              <p className="text-muted-foreground">{invite.email}</p>
              {invite.inviteToken && (
                <Button asChild size="sm" variant="outline" className="mt-2">
                  <Link href={`/invite/${invite.inviteToken}`}>Respond to Invite</Link>
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Teams I am on</h2>
        {memberships?.length === 0 && (
          <p className="text-sm text-muted-foreground">You are not on any teams yet.</p>
        )}
        <div className="grid gap-2">
          {memberships?.map((member) => (
            <div key={member._id} className="rounded border p-3 text-sm">
              <p>{member.name}</p>
              <p className="text-muted-foreground">{member.status}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
