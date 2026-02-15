import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function computeTeamStatus(ctx: MutationCtx, team: Doc<"teams">) {
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

async function refreshTeamStatus(ctx: MutationCtx, teamId: Doc<"teams">["_id"]) {
  const team = await ctx.db.get(teamId);
  if (!team) {
    return;
  }
  const status = await computeTeamStatus(ctx, team);
  await ctx.db.patch(team._id, { status });
}

export const getByInviteToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const member = await ctx.db
      .query("teamMembers")
      .withIndex("by_inviteToken", (q) => q.eq("inviteToken", args.token))
      .first();
    if (!member) {
      return null;
    }
    const team = await ctx.db.get(member.teamId);
    if (!team) {
      return null;
    }
    const session = await ctx.db.get(team.sessionId);
    return { member, team, session };
  },
});

export const respondToInvite = mutation({
  args: {
    token: v.string(),
    response: v.union(v.literal("confirmed"), v.literal("declined")),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const member = await ctx.db
      .query("teamMembers")
      .withIndex("by_inviteToken", (q) => q.eq("inviteToken", args.token))
      .first();
    if (!member) {
      throw new Error("Invite not found.");
    }
    if (member.role !== "player") {
      throw new Error("Only player invites can be responded to from this link.");
    }
    if (member.status !== "invited") {
      throw new Error("This invite has already been responded to.");
    }

    const identity = await ctx.auth.getUserIdentity();
    const patch: Partial<Doc<"teamMembers">> = {
      status: args.response,
    };
    if (args.name?.trim()) {
      patch.name = args.name.trim();
    }
    if (identity?.subject) {
      patch.clerkUserId = identity.subject;
    }

    await ctx.db.patch(member._id, patch);
    await refreshTeamStatus(ctx, member.teamId);
    return { ok: true };
  },
});

export const addMember = mutation({
  args: {
    teamId: v.id("teams"),
    name: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required.");
    }
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found.");
    }
    if (team.captainUserId !== identity.subject) {
      throw new Error("Only captain can add members.");
    }

    const email = normalizeEmail(args.email);
    const name = args.name.trim();
    if (!name) {
      throw new Error("Player name is required.");
    }
    if (!isValidEmail(email)) {
      throw new Error("Player email is invalid.");
    }
    const existing = await ctx.db
      .query("teamMembers")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .collect();
    if (existing.some((member) => member.email === email)) {
      throw new Error("This player is already on the team.");
    }
    if (existing.length >= 4) {
      throw new Error("Team already has 4 players.");
    }

    const memberId = await ctx.db.insert("teamMembers", {
      teamId: args.teamId,
      name,
      email,
      role: "player",
      status: "invited",
      inviteToken: crypto.randomUUID(),
    });
    await refreshTeamStatus(ctx, args.teamId);
    return memberId;
  },
});

export const removeMember = mutation({
  args: {
    teamId: v.id("teams"),
    memberId: v.id("teamMembers"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required.");
    }
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found.");
    }
    if (team.captainUserId !== identity.subject) {
      throw new Error("Only captain can remove members.");
    }

    const member = await ctx.db.get(args.memberId);
    if (!member || member.teamId !== args.teamId) {
      throw new Error("Member not found.");
    }
    if (member.role === "captain") {
      throw new Error("Cannot remove captain.");
    }

    await ctx.db.delete(args.memberId);
    await refreshTeamStatus(ctx, args.teamId);
    return { ok: true };
  },
});

export const listByTeam = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("teamMembers")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .collect();
  },
});

export const listMyPendingInvites = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.email) {
      return [];
    }
    const email = normalizeEmail(identity.email);
    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    return members.filter((member) => member.status === "invited");
  },
});

export const listMyMemberships = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const byUserId = identity.subject
      ? await ctx.db
          .query("teamMembers")
          .filter((q) => q.eq(q.field("clerkUserId"), identity.subject))
          .collect()
      : [];
    const byEmail = identity.email
      ? await ctx.db
          .query("teamMembers")
          .withIndex("by_email", (q) => q.eq("email", normalizeEmail(identity.email!)))
          .collect()
      : [];

    const dedup = new Map<string, (typeof byUserId)[number]>();
    for (const member of [...byUserId, ...byEmail]) {
      dedup.set(member._id, member);
    }

    return Array.from(dedup.values());
  },
});
