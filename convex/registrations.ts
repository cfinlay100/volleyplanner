import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { getOrCreatePersonFromIdentity } from "./peopleUtils";

type WeeklyStatus = "active" | "inactive" | "not_invited";

async function requireIdentity(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required.");
  }
  return identity;
}

async function ensureCaptain(ctx: MutationCtx, teamId: Id<"teams">) {
  const identity = await requireIdentity(ctx);
  const team = await ctx.db.get(teamId);
  if (!team) {
    throw new Error("Team not found.");
  }
  if (team.captainUserId !== identity.subject) {
    throw new Error("Only captains can manage session registrations.");
  }
  return { identity, team };
}

async function listActiveRoster(ctx: MutationCtx, teamId: Id<"teams">) {
  return await ctx.db
    .query("teamRosterMembers")
    .withIndex("by_teamId", (q) => q.eq("teamId", teamId))
    .collect();
}

async function enforceWeeklyConflicts(
  ctx: MutationCtx,
  args: {
    weekOf: string;
    activePersonIds: Id<"people">[];
    excludeRegistrationId?: Id<"sessionRegistrations">;
  }
) {
  for (const personId of args.activePersonIds) {
    const registrationsForPerson = await ctx.db
      .query("sessionRegistrationMembers")
      .withIndex("by_personId", (q) => q.eq("personId", personId))
      .collect();

    for (const member of registrationsForPerson) {
      if (args.excludeRegistrationId && member.registrationId === args.excludeRegistrationId) {
        continue;
      }
      if (member.weeklyStatus !== "active") {
        continue;
      }
      const reg = await ctx.db.get(member.registrationId);
      if (!reg || reg.status === "cancelled" || reg.weekOf !== args.weekOf) {
        continue;
      }

      const person = await ctx.db.get(personId);
      const conflictTeam = await ctx.db.get(reg.teamId);
      const conflictSession = await ctx.db.get(reg.sessionId);
      throw new Error(
        `${person?.name ?? "Member"} is already active for ${
          conflictTeam?.name ?? "another team"
        } on ${conflictSession?.date ?? "this week"}.`
      );
    }
  }
}

function registrationStatusFromActiveCount(activeCount: number) {
  if (activeCount >= 3) {
    return "confirmed" as const;
  }
  return "forming" as const;
}

function toInviteStatus(status: WeeklyStatus) {
  if (status === "active") {
    return "invited" as const;
  }
  if (status === "inactive") {
    return "inactive" as const;
  }
  return "not_invited" as const;
}

export const registerTeamForSession = mutation({
  args: {
    teamId: v.id("teams"),
    sessionId: v.id("sessions"),
    memberSelections: v.optional(
      v.array(
        v.object({
          personId: v.id("people"),
          weeklyStatus: v.union(
            v.literal("active"),
            v.literal("inactive"),
            v.literal("not_invited")
          ),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const { team } = await ensureCaptain(ctx, args.teamId);
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found.");
    }

    const existing = await ctx.db
      .query("sessionRegistrations")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    if (existing.some((registration) => registration.teamId === args.teamId && registration.status !== "cancelled")) {
      throw new Error("This team is already joined to this session.");
    }

    const roster = (await listActiveRoster(ctx, args.teamId)).filter((member) => !member.isArchived);
    if (roster.length === 0) {
      throw new Error("Team has no active roster members.");
    }

    const selectionMap = new Map<Id<"people">, WeeklyStatus>();
    for (const rosterMember of roster) {
      selectionMap.set(rosterMember.personId, rosterMember.defaultWeeklyStatus);
    }
    for (const selected of args.memberSelections ?? []) {
      if (selectionMap.has(selected.personId)) {
        selectionMap.set(selected.personId, selected.weeklyStatus);
      }
    }

    const activePersonIds = Array.from(selectionMap.entries())
      .filter(([, status]) => status === "active")
      .map(([personId]) => personId);

    await enforceWeeklyConflicts(ctx, {
      weekOf: session.weekOf,
      activePersonIds,
    });

    const registrationId = await ctx.db.insert("sessionRegistrations", {
      teamId: args.teamId,
      sessionId: args.sessionId,
      weekOf: session.weekOf,
      status: registrationStatusFromActiveCount(activePersonIds.length),
      createdAt: Date.now(),
    });

    await Promise.all(
      Array.from(selectionMap.entries()).map(async ([personId, weeklyStatus]) => {
        await ctx.db.insert("sessionRegistrationMembers", {
          registrationId,
          personId,
          weeklyStatus,
          inviteStatus: toInviteStatus(weeklyStatus),
          inviteToken: weeklyStatus === "active" ? crypto.randomUUID() : undefined,
          createdAt: Date.now(),
        });
      })
    );

    return registrationId;
  },
});

export const leaveSession = mutation({
  args: {
    registrationId: v.id("sessionRegistrations"),
  },
  handler: async (ctx, args) => {
    const registration = await ctx.db.get(args.registrationId);
    if (!registration) {
      throw new Error("Registration not found.");
    }
    await ensureCaptain(ctx, registration.teamId);
    await ctx.db.patch(args.registrationId, { status: "cancelled" });
    return { ok: true };
  },
});

export const updateRegistrationMembers = mutation({
  args: {
    registrationId: v.id("sessionRegistrations"),
    memberSelections: v.array(
      v.object({
        personId: v.id("people"),
        weeklyStatus: v.union(
          v.literal("active"),
          v.literal("inactive"),
          v.literal("not_invited")
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    const registration = await ctx.db.get(args.registrationId);
    if (!registration) {
      throw new Error("Registration not found.");
    }
    await ensureCaptain(ctx, registration.teamId);

    const activePersonIds = args.memberSelections
      .filter((selection) => selection.weeklyStatus === "active")
      .map((selection) => selection.personId);

    await enforceWeeklyConflicts(ctx, {
      weekOf: registration.weekOf,
      activePersonIds,
      excludeRegistrationId: args.registrationId,
    });

    const current = await ctx.db
      .query("sessionRegistrationMembers")
      .withIndex("by_registrationId", (q) => q.eq("registrationId", args.registrationId))
      .collect();
    const byPerson = new Map(current.map((item) => [item.personId, item]));

    await Promise.all(
      args.memberSelections.map(async (selection) => {
        const existing = byPerson.get(selection.personId);
        if (!existing) {
          await ctx.db.insert("sessionRegistrationMembers", {
            registrationId: args.registrationId,
            personId: selection.personId,
            weeklyStatus: selection.weeklyStatus,
            inviteStatus: toInviteStatus(selection.weeklyStatus),
            inviteToken: selection.weeklyStatus === "active" ? crypto.randomUUID() : undefined,
            createdAt: Date.now(),
          });
          return;
        }
        await ctx.db.patch(existing._id, {
          weeklyStatus: selection.weeklyStatus,
          inviteStatus: toInviteStatus(selection.weeklyStatus),
          inviteToken:
            selection.weeklyStatus === "active"
              ? existing.inviteToken ?? crypto.randomUUID()
              : undefined,
        });
      })
    );

    await ctx.db.patch(args.registrationId, {
      status: registrationStatusFromActiveCount(activePersonIds.length),
    });
    return { ok: true };
  },
});

export const getRegistrationForTeamAndSession = query({
  args: {
    teamId: v.id("teams"),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const registration = await ctx.db
      .query("sessionRegistrations")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const item = registration.find(
      (entry) => entry.teamId === args.teamId && entry.status !== "cancelled"
    );
    if (!item) {
      return null;
    }
    const members = await ctx.db
      .query("sessionRegistrationMembers")
      .withIndex("by_registrationId", (q) => q.eq("registrationId", item._id))
      .collect();
    const membersWithPerson = await Promise.all(
      members.map(async (member) => ({
        ...member,
        person: await ctx.db.get(member.personId),
      }))
    );
    return { ...item, members: membersWithPerson };
  },
});

export const listMyRegistrations = query({
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

    const registrations = await Promise.all(
      teams.map(async (team) => {
        const teamRegs = await ctx.db
          .query("sessionRegistrations")
          .withIndex("by_teamId", (q) => q.eq("teamId", team._id))
          .collect();
        return await Promise.all(
          teamRegs
            .filter((registration) => registration.status !== "cancelled")
            .map(async (registration) => ({
              ...registration,
              team,
              session: await ctx.db.get(registration.sessionId),
            }))
        );
      })
    );

    return registrations.flat().sort((a, b) =>
      (a.session?.date ?? "").localeCompare(b.session?.date ?? "")
    );
  },
});

export const createMyPersonRecord = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    return await getOrCreatePersonFromIdentity(ctx, {
      subject: identity.subject,
      email: identity.email,
      name: identity.name,
    });
  },
});
