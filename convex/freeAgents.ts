import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export const signUp = mutation({
  args: {
    sessionId: v.id("sessions"),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found.");
    }

    const identity = await ctx.auth.getUserIdentity();
    const email = normalizeEmail(args.email);
    const name = args.name.trim();
    if (!name) {
      throw new Error("Name is required.");
    }
    if (!isValidEmail(email)) {
      throw new Error("Email is invalid.");
    }
    const existing = await ctx.db
      .query("freeAgents")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    if (existing.some((freeAgent) => freeAgent.email === email && freeAgent.status === "available")) {
      throw new Error("You are already signed up as a free agent for this session.");
    }

    return await ctx.db.insert("freeAgents", {
      sessionId: args.sessionId,
      name,
      email,
      phone: args.phone?.trim() || undefined,
      clerkUserId: identity?.subject,
      status: "available",
    });
  },
});

export const listBySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const freeAgents = await ctx.db
      .query("freeAgents")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    return freeAgents.filter((freeAgent) => freeAgent.status === "available");
  },
});

export const withdraw = mutation({
  args: {
    freeAgentId: v.id("freeAgents"),
  },
  handler: async (ctx, args) => {
    const freeAgent = await ctx.db.get(args.freeAgentId);
    if (!freeAgent) {
      throw new Error("Free agent record not found.");
    }

    const identity = await ctx.auth.getUserIdentity();
    const canWithdraw =
      (identity?.subject && freeAgent.clerkUserId === identity.subject) ||
      (identity?.email && normalizeEmail(identity.email) === freeAgent.email);

    if (!canWithdraw) {
      throw new Error("You do not have permission to withdraw this free-agent signup.");
    }

    await ctx.db.patch(args.freeAgentId, { status: "assigned" });
    return { ok: true };
  },
});
