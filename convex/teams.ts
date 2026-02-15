import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { isValidEmail, normalizeEmail, upsertPerson } from "./peopleUtils";

async function requireIdentity(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required.");
  }
  return identity;
}

async function isTeamMember(ctx: MutationCtx | any, teamId: Id<"teams">, identity: { subject: string; email?: string }) {
  const byTeam = await ctx.db
    .query("teamRosterMembers")
    .withIndex("by_teamId", (q: any) => q.eq("teamId", teamId))
    .collect();
  if (byTeam.length === 0) {
    return false;
  }
  const identityEmail = normalizeEmail(identity.email ?? "");
  for (const roster of byTeam) {
    const person = await ctx.db.get(roster.personId);
    if (!person) {
      continue;
    }
    if (person.clerkUserId === identity.subject) {
      return true;
    }
    if (identityEmail && person.email === identityEmail) {
      return true;
    }
  }
  return false;
}

export const createTeam = mutation({
  args: {
    teamName: v.string(),
    players: v.array(
      v.object({
        name: v.string(),
        email: v.string(),
      })
    ),
    sessionId: v.optional(v.id("sessions")),
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
      createdAt: now,
      defaultWeeklyStatus: "active",
    });

    const captainPersonId = await upsertPerson(ctx, {
      name: identity.name ?? "Captain",
      email: captainEmail,
      clerkUserId: identity.subject,
    });
    await ctx.db.insert("teamRosterMembers", {
      teamId,
      personId: captainPersonId,
      role: "captain",
      defaultWeeklyStatus: "active",
      isArchived: false,
      createdAt: now,
    });

    await Promise.all(
      normalized.map(async (player) => {
        const personId = await upsertPerson(ctx, {
          name: player.name,
          email: player.email,
        });
        return await ctx.db.insert("teamRosterMembers", {
          teamId,
          personId,
          role: "player",
          defaultWeeklyStatus: "active",
          isArchived: false,
          createdAt: now,
        });
      })
    );

    if (args.sessionId) {
      const session = await ctx.db.get(args.sessionId);
      if (session) {
        const existing = await ctx.db
          .query("sessionRegistrations")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId!))
          .collect();
        if (!existing.some((registration) => registration.teamId === teamId && registration.status !== "cancelled")) {
          const registrationId = await ctx.db.insert("sessionRegistrations", {
            teamId,
            sessionId: args.sessionId,
            weekOf: session.weekOf,
            status: "confirmed",
            createdAt: now,
          });
          const roster = await ctx.db
            .query("teamRosterMembers")
            .withIndex("by_teamId", (q) => q.eq("teamId", teamId))
            .collect();
          await Promise.all(
            roster.map((member) =>
              ctx.db.insert("sessionRegistrationMembers", {
                registrationId,
                personId: member.personId,
                weeklyStatus: member.defaultWeeklyStatus,
                inviteStatus: member.defaultWeeklyStatus === "active" ? "invited" : member.defaultWeeklyStatus,
                inviteToken: member.defaultWeeklyStatus === "active" ? crypto.randomUUID() : undefined,
                createdAt: now,
              })
            )
          );
        }
      }
    }

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
    const isCaptain = team.captainUserId === identity.subject;
    const isMember = isCaptain || (await isTeamMember(ctx, args.teamId, identity));
    if (!isMember) {
      return null;
    }

    const roster = await ctx.db
      .query("teamRosterMembers")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .collect();
    const rosterWithPeople = await Promise.all(
      roster
        .filter((member) => !member.isArchived)
        .map(async (member) => ({
          ...member,
          person: await ctx.db.get(member.personId),
        }))
    );
    const registrations = await ctx.db
      .query("sessionRegistrations")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .collect();
    const upcoming = await Promise.all(
      registrations
        .filter((registration) => registration.status !== "cancelled")
        .map(async (registration) => ({
          ...registration,
          session: await ctx.db.get(registration.sessionId),
        }))
    );
    return {
      ...team,
      members: rosterWithPeople,
      registrations: upcoming.sort((a, b) =>
        (a.session?.date ?? "").localeCompare(b.session?.date ?? "")
      ),
      canManage: isCaptain,
    };
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

export const listMyTeamsWithRoster = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_captainUserId", (q) => q.eq("captainUserId", identity.subject))
      .collect();

    const withDetails = await Promise.all(
      teams.map(async (team) => {
        const members = await ctx.db
          .query("teamRosterMembers")
          .withIndex("by_teamId", (q) => q.eq("teamId", team._id))
          .collect();
        const membersWithPeople = await Promise.all(
          members
            .filter((member) => !member.isArchived)
            .map(async (member) => ({
              ...member,
              person: await ctx.db.get(member.personId),
            }))
        );
        const registrations = await ctx.db
          .query("sessionRegistrations")
          .withIndex("by_teamId", (q) => q.eq("teamId", team._id))
          .collect();
        const upcoming = await Promise.all(
          registrations
            .filter((registration) => registration.status !== "cancelled")
            .map(async (registration) => ({
              ...registration,
              session: await ctx.db.get(registration.sessionId),
            }))
        );
        const nextRegistration = upcoming
          .filter((entry) => Boolean(entry.session?.date))
          .sort((a, b) =>
            (a.session?.date ?? "").localeCompare(b.session?.date ?? "")
          )[0];

        return { ...team, members: membersWithPeople, nextRegistration };
      })
    );

    return withDetails.sort((a, b) => {
      const aDate = a.nextRegistration?.session?.date ?? "";
      const bDate = b.nextRegistration?.session?.date ?? "";
      if (!aDate && !bDate) {
        return a.createdAt - b.createdAt;
      }
      if (!aDate) {
        return 1;
      }
      if (!bDate) {
        return -1;
      }
      return aDate.localeCompare(bDate);
    });
  },
});

export const listBySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const registrations = await ctx.db
      .query("sessionRegistrations")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const teams = await Promise.all(
      registrations
        .filter((registration) => registration.status !== "cancelled")
        .map(async (registration) => ({
          registration,
          team: await ctx.db.get(registration.teamId),
        }))
    );
    return teams.filter((item) => Boolean(item.team));
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
    const nextName = args.teamName.trim();
    if (nextName.length < 2) {
      throw new Error("Team name must be at least 2 characters.");
    }
    await ctx.db.patch(args.teamId, { name: nextName });
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
      .query("teamRosterMembers")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .collect();
    const registrations = await ctx.db
      .query("sessionRegistrations")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .collect();
    for (const registration of registrations) {
      const registrationMembers = await ctx.db
        .query("sessionRegistrationMembers")
        .withIndex("by_registrationId", (q) => q.eq("registrationId", registration._id))
        .collect();
      await Promise.all(registrationMembers.map((member) => ctx.db.delete(member._id)));
      await ctx.db.delete(registration._id);
    }

    await Promise.all(members.map((member) => ctx.db.delete(member._id)));
    await ctx.db.delete(args.teamId);
    return { deleted: true };
  },
});

export const recomputeTeamStatus = mutation({
  args: { teamId: v.id("teams") },
  handler: async () => "deprecated",
});

export type TeamId = Id<"teams">;
