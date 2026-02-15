import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema(
  {
    sessions: defineTable({
      date: v.string(),
      day: v.union(
        v.literal("tuesday"),
        v.literal("wednesday"),
        v.literal("thursday")
      ),
      weekOf: v.string(),
      maxTeams: v.number(),
    })
      .index("by_weekOf", ["weekOf"])
      .index("by_date", ["date"]),

    teams: defineTable({
      name: v.string(),
      captainUserId: v.string(),
      captainName: v.string(),
      captainEmail: v.string(),
      sessionId: v.id("sessions"),
      status: v.union(
        v.literal("forming"),
        v.literal("confirmed"),
        v.literal("waitlisted")
      ),
      createdAt: v.number(),
    })
      .index("by_sessionId", ["sessionId"])
      .index("by_captainUserId", ["captainUserId"]),

    teamMembers: defineTable({
      teamId: v.id("teams"),
      name: v.string(),
      email: v.string(),
      role: v.union(v.literal("captain"), v.literal("player")),
      status: v.union(
        v.literal("invited"),
        v.literal("confirmed"),
        v.literal("declined")
      ),
      inviteToken: v.optional(v.string()),
      clerkUserId: v.optional(v.string()),
    })
      .index("by_teamId", ["teamId"])
      .index("by_inviteToken", ["inviteToken"])
      .index("by_email", ["email"]),

    freeAgents: defineTable({
      sessionId: v.id("sessions"),
      name: v.string(),
      email: v.string(),
      phone: v.optional(v.string()),
      clerkUserId: v.optional(v.string()),
      status: v.union(v.literal("available"), v.literal("assigned")),
    }).index("by_sessionId", ["sessionId"]),
  },
  { schemaValidation: true }
);
