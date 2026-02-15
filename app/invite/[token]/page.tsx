"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const invite = useQuery(api.teamMembers.getByInviteToken, { token });
  const respond = useMutation(api.teamMembers.respondToInvite);
  const [name, setName] = useState("");

  if (invite === undefined) {
    return <p className="text-sm text-muted-foreground">Loading invite...</p>;
  }
  if (invite === null || !invite.member || !invite.team || !invite.session) {
    return <p className="text-sm text-muted-foreground">Invite not found.</p>;
  }

  async function sendResponse(response: "confirmed" | "declined") {
    try {
      await respond({ token, response, name: name || undefined });
      toast.success(`You have ${response === "confirmed" ? "confirmed" : "declined"} this invite.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to respond to invite.");
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Team Invite</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p>
          Team: <span className="font-medium">{invite.team.name}</span>
        </p>
        <p>
          Session: {invite.session.day.toUpperCase()} - {invite.session.date}
        </p>
        <p>Captain: {invite.team.captainName}</p>
        <div className="space-y-2">
          <Label htmlFor="name">Your name (optional)</Label>
          <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void sendResponse("confirmed")}>Confirm</Button>
          <Button variant="outline" onClick={() => void sendResponse("declined")}>
            Decline
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
