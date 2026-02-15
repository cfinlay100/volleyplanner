import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { isValidEmail, normalizeEmail, upsertPerson } from "./peopleUtils";

export const getByInviteToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const member = await ctx.db
      .query("sessionRegistrationMembers")
      .withIndex("by_inviteToken", (q) => q.eq("inviteToken", args.token))
      .first();
    if (!member) {
      return null;
    }
    const registration = await ctx.db.get(member.registrationId);
    if (!registration) {
      return null;
    }
    const team = await ctx.db.get(registration.teamId);
    if (!team) {
      return null;
    }
    const person = await ctx.db.get(member.personId);
    const sessionRecord = await ctx.db.get(registration.sessionId);
    return { member: { ...member, person }, team, session: sessionRecord };
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
      .query("sessionRegistrationMembers")
      .withIndex("by_inviteToken", (q) => q.eq("inviteToken", args.token))
      .first();
    if (!member) {
      throw new Error("Invite not found.");
    }
    if (member.inviteStatus !== "invited") {
      throw new Error("This invite has already been responded to.");
    }

    const identity = await ctx.auth.getUserIdentity();
    const patch: Partial<Doc<"sessionRegistrationMembers">> = {
      inviteStatus: args.response,
      respondedAt: Date.now(),
    };
    if (args.name?.trim()) {
      const person = await ctx.db.get(member.personId);
      if (person) {
        await ctx.db.patch(person._id, { name: args.name.trim() });
      }
    }
    if (identity?.subject) {
      const person = await ctx.db.get(member.personId);
      if (person) {
        await ctx.db.patch(person._id, { clerkUserId: identity.subject });
      }
    }

    await ctx.db.patch(member._id, patch);
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
    const personId = await upsertPerson(ctx, { name, email });
    const existing = await ctx.db
      .query("teamRosterMembers")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .collect();
    if (existing.some((member) => member.personId === personId && !member.isArchived)) {
      throw new Error("This player is already on the team.");
    }
    const memberId = await ctx.db.insert("teamRosterMembers", {
      teamId: args.teamId,
      personId,
      role: "player",
      defaultWeeklyStatus: "active",
      isArchived: false,
      createdAt: Date.now(),
    });
    return memberId;
  },
});

export const removeMember = mutation({
  args: {
    teamId: v.id("teams"),
    memberId: v.id("teamRosterMembers"),
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

    await ctx.db.patch(args.memberId, { isArchived: true, defaultWeeklyStatus: "not_invited" });
    return { ok: true };
  },
});

export const listByTeam = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const roster = await ctx.db
      .query("teamRosterMembers")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .collect();
    return await Promise.all(
      roster.map(async (member) => ({
        ...member,
        person: await ctx.db.get(member.personId),
      }))
    );
  },
});

export const listMyPendingInvites = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.email && !identity?.subject) {
      return [];
    }

    const people = identity.subject
      ? await ctx.db
          .query("people")
          .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
          .collect()
      : [];
    if (identity.email) {
      const byEmail = await ctx.db
        .query("people")
        .withIndex("by_email", (q) => q.eq("email", normalizeEmail(identity.email!)))
        .collect();
      for (const person of byEmail) {
        if (!people.some((p) => p._id === person._id)) {
          people.push(person);
        }
      }
    }
    const invites = await Promise.all(
      people.map(async (person) =>
        await ctx.db
          .query("sessionRegistrationMembers")
          .withIndex("by_personId", (q) => q.eq("personId", person._id))
          .collect()
      )
    );
    return invites
      .flat()
      .filter((member) => member.inviteStatus === "invited");
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
          .query("people")
          .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
          .collect()
      : [];
    const byEmail = identity.email
      ? await ctx.db
          .query("people")
          .withIndex("by_email", (q) => q.eq("email", normalizeEmail(identity.email!)))
          .collect()
      : [];

    const dedup = new Map<string, (typeof byUserId)[number]>();
    for (const person of [...byUserId, ...byEmail]) {
      dedup.set(person._id, person);
    }

    const memberships = await Promise.all(
      Array.from(dedup.values()).map(async (person) => {
        const rosterEntries = await ctx.db
          .query("teamRosterMembers")
          .withIndex("by_personId", (q) => q.eq("personId", person._id))
          .collect();
        return await Promise.all(
          rosterEntries.map(async (entry) => ({
            ...entry,
            team: await ctx.db.get(entry.teamId),
            person,
          }))
        );
      })
    );
    return memberships.flat();
  },
});

export const updateDefaultWeeklyStatus = mutation({
  args: {
    rosterMemberId: v.id("teamRosterMembers"),
    defaultWeeklyStatus: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("not_invited")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required.");
    }
    const roster = await ctx.db.get(args.rosterMemberId);
    if (!roster) {
      throw new Error("Roster member not found.");
    }
    const team = await ctx.db.get(roster.teamId);
    if (!team || team.captainUserId !== identity.subject) {
      throw new Error("Only captain can update defaults.");
    }
    await ctx.db.patch(args.rosterMemberId, {
      defaultWeeklyStatus: args.defaultWeeklyStatus,
    });
    return { ok: true };
  },
});
