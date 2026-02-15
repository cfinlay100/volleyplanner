import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function requireIdentity(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required.");
  }
  return identity;
}

async function computeTeamStatus(
  ctx: MutationCtx,
  team: Doc<"teams">
) {
  const members = await ctx.db
    .query("teamMembers")
    .withIndex("by_teamId", (q) => q.eq("teamId", team._id))
    .collect();
  const confirmedCount = members.filter((member) => member.status === "confirmed").length;

  if (confirmedCount < 3) {
    return "forming" as const;
  }

  const session = await ctx.db.get(team.sessionId);
  if (!session) {
    return "forming" as const;
  }

  const teamsInSession = await ctx.db
    .query("teams")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", team.sessionId))
    .collect();

  const confirmedTeams = teamsInSession
    .filter((sessionTeam) => sessionTeam.status === "confirmed" || sessionTeam._id === team._id)
    .sort((a, b) => a.createdAt - b.createdAt);
  const rank = confirmedTeams.findIndex((sessionTeam) => sessionTeam._id === team._id);

  if (rank >= session.maxTeams) {
    return "waitlisted" as const;
  }

  return "confirmed" as const;
}

export const createTeam = mutation({
  args: {
    sessionId: v.id("sessions"),
    teamName: v.string(),
    players: v.array(
      v.object({
        name: v.string(),
        email: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required.");
    }
    if (args.teamName.trim().length < 2) {
      throw new Error("Team name must be at least 2 characters.");
    }
    if (args.players.length < 2 || args.players.length > 3) {
      throw new Error("Teams must include captain plus 2 or 3 invited players.");
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found.");
    }

    const captainEmail = normalizeEmail(identity.email ?? "");
    if (!captainEmail) {
      throw new Error("Captain account must include an email.");
    }

    const normalized = args.players.map((player) => ({
      name: player.name.trim(),
      email: normalizeEmail(player.email),
    }));
    const uniqueEmails = new Set<string>([captainEmail, ...normalized.map((p) => p.email)]);
    if (uniqueEmails.size !== normalized.length + 1) {
      throw new Error("All players must have unique email addresses.");
    }
    if (normalized.some((player) => !player.name || !player.email)) {
      throw new Error("All players need both name and email.");
    }
    if (normalized.some((player) => !isValidEmail(player.email))) {
      throw new Error("All players must have valid email addresses.");
    }

    const now = Date.now();
    const teamId = await ctx.db.insert("teams", {
      name: args.teamName.trim(),
      captainUserId: identity.subject,
      captainName: identity.name ?? "Captain",
      captainEmail,
      sessionId: args.sessionId,
      status: "forming",
      createdAt: now,
    });

    await ctx.db.insert("teamMembers", {
      teamId,
      name: identity.name ?? "Captain",
      email: captainEmail,
      role: "captain",
      status: "confirmed",
      clerkUserId: identity.subject,
    });

    await Promise.all(
      normalized.map(async (player) =>
        ctx.db.insert("teamMembers", {
          teamId,
          name: player.name,
          email: player.email,
          role: "player",
          status: "invited",
          inviteToken: crypto.randomUUID(),
        })
      )
    );

    const team = await ctx.db.get(teamId);
    if (!team) {
      throw new Error("Failed to create team.");
    }
    const status = await computeTeamStatus(ctx, team);
    await ctx.db.patch(teamId, { status });
    return teamId;
  },
});

export const getTeam = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      return null;
    }
    const session = await ctx.db.get(team.sessionId);
    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .collect();

    const isCaptain = team.captainUserId === identity.subject;
    const identityEmail = normalizeEmail(identity.email ?? "");
    const isMember = members.some(
      (member) =>
        member.clerkUserId === identity.subject ||
        (identityEmail.length > 0 && member.email === identityEmail)
    );

    if (!isCaptain && !isMember) {
      return null;
    }

    const safeMembers = members.map((member) =>
      isCaptain ? member : { ...member, inviteToken: undefined }
    );

    return { ...team, session, members: safeMembers, canManage: isCaptain };
  },
});

export const listMyTeams = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    return await ctx.db
      .query("teams")
      .withIndex("by_captainUserId", (q) => q.eq("captainUserId", identity.subject))
      .collect();
  },
});

export const listBySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("teams")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

export const updateTeam = mutation({
  args: {
    teamId: v.id("teams"),
    teamName: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found.");
    }
    if (team.captainUserId !== identity.subject) {
      throw new Error("Only captain can update this team.");
    }
    await ctx.db.patch(args.teamId, { name: args.teamName.trim() });
    return args.teamId;
  },
});

export const deleteTeam = mutation({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found.");
    }
    if (team.captainUserId !== identity.subject) {
      throw new Error("Only captain can delete this team.");
    }

    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .collect();

    await Promise.all(members.map((member) => ctx.db.delete(member._id)));
    await ctx.db.delete(args.teamId);
    return { deleted: true };
  },
});

export const recomputeTeamStatus = mutation({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      return null;
    }
    const status = await computeTeamStatus(ctx, team);
    await ctx.db.patch(args.teamId, { status });
    return status;
  },
});

export type TeamId = Id<"teams">;
