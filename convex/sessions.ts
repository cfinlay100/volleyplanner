import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";

const SESSION_DAYS = [
  { label: "tuesday", dayNumber: 2 },
  { label: "wednesday", dayNumber: 3 },
  { label: "thursday", dayNumber: 4 },
] as const;

type SessionDay = (typeof SESSION_DAYS)[number]["label"];

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfWeekMonday(date: Date): Date {
  const day = date.getUTCDay(); // 0 Sun..6 Sat
  const diffToMonday = (day + 6) % 7;
  const monday = startOfUtcDay(date);
  monday.setUTCDate(monday.getUTCDate() - diffToMonday);
  return monday;
}

function dayFromMonday(weekMonday: Date, targetDayNumber: number): Date {
  const d = new Date(weekMonday);
  d.setUTCDate(d.getUTCDate() + (targetDayNumber - 1));
  return d;
}

export const ensureUpcomingSessions = internalMutation({
  args: { weeksAhead: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ensureSessions(ctx, args.weeksAhead ?? 3);
  },
});

export const ensureUpcomingSessionsPublic = mutation({
  args: { weeksAhead: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ensureSessions(ctx, args.weeksAhead ?? 3);
  },
});

async function ensureSessions(
  ctx: MutationCtx,
  weeksAhead: number
) {
  const now = new Date();
  const weekStart = startOfWeekMonday(now);
  let inserted = 0;

  for (let weekOffset = 0; weekOffset < weeksAhead; weekOffset += 1) {
    const weekMonday = new Date(weekStart);
    weekMonday.setUTCDate(weekMonday.getUTCDate() + weekOffset * 7);
    const weekOf = toIsoDate(weekMonday);

    for (const sessionDay of SESSION_DAYS) {
      const sessionDate = dayFromMonday(weekMonday, sessionDay.dayNumber);
      const date = toIsoDate(sessionDate);
      const existing = await ctx.db
        .query("sessions")
        .withIndex("by_date", (q) => q.eq("date", date))
        .first();

      if (!existing) {
        await ctx.db.insert("sessions", {
          date,
          day: sessionDay.label,
          weekOf,
          maxTeams: 24,
        });
        inserted += 1;
      }
    }
  }

  return { inserted };
}

export const listUpcoming = query({
  args: {},
  handler: async (ctx) => {
    const today = toIsoDate(new Date());
    const sessions = await ctx.db.query("sessions").withIndex("by_date").collect();
    const upcoming = sessions
      .filter((session) => session.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));

    const withCounts = await Promise.all(
      upcoming.map(async (session) => {
        const registrations = await ctx.db
          .query("sessionRegistrations")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
          .collect();
        const activeRegistrations = registrations.filter(
          (registration) => registration.status !== "cancelled"
        );
        return {
          ...session,
          teamCount: activeRegistrations.length,
          spotsRemaining: Math.max(0, session.maxTeams - activeRegistrations.length),
        };
      })
    );

    return withCounts;
  },
});

export const getSession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      return null;
    }

    const registrations = await ctx.db
      .query("sessionRegistrations")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const activeRegistrations = registrations.filter(
      (registration) => registration.status !== "cancelled"
    );
    const teamsWithMembers = await Promise.all(
      activeRegistrations.map(async (registration) => {
        const team = await ctx.db.get(registration.teamId);
        if (!team) {
          return null;
        }
        const registrationMembers = await ctx.db
          .query("sessionRegistrationMembers")
          .withIndex("by_registrationId", (q) => q.eq("registrationId", registration._id))
          .collect();
        const members = await Promise.all(
          registrationMembers.map(async (member) => ({
            ...member,
            person: await ctx.db.get(member.personId),
          }))
        );
        return { ...team, registration, members };
      })
    );

    return {
      ...session,
      teamCount: activeRegistrations.length,
      spotsRemaining: Math.max(0, session.maxTeams - activeRegistrations.length),
      teams: teamsWithMembers
        .filter((team) => team !== null)
        .sort((a, b) => (a!.createdAt ?? 0) - (b!.createdAt ?? 0)),
    };
  },
});

export type { SessionDay };
