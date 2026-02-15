import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema(
  {
    people: defineTable({
      name: v.string(),
      email: v.string(),
      clerkUserId: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_email", ["email"])
      .index("by_clerkUserId", ["clerkUserId"]),

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
      createdAt: v.number(),
      defaultWeeklyStatus: v.optional(
        v.union(v.literal("active"), v.literal("inactive"), v.literal("not_invited"))
      ),
    }).index("by_captainUserId", ["captainUserId"]),

    teamRosterMembers: defineTable({
      teamId: v.id("teams"),
      personId: v.id("people"),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      role: v.union(v.literal("captain"), v.literal("player")),
      defaultWeeklyStatus: v.union(
        v.literal("active"),
        v.literal("inactive"),
        v.literal("not_invited")
      ),
      isArchived: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_teamId", ["teamId"])
      .index("by_personId", ["personId"]),

    sessionRegistrations: defineTable({
      sessionId: v.id("sessions"),
      teamId: v.id("teams"),
      weekOf: v.string(),
      status: v.union(
        v.literal("forming"),
        v.literal("confirmed"),
        v.literal("waitlisted"),
        v.literal("cancelled")
      ),
      createdAt: v.number(),
    })
      .index("by_sessionId", ["sessionId"])
      .index("by_teamId", ["teamId"])
      .index("by_weekOf", ["weekOf"]),

    sessionRegistrationMembers: defineTable({
      registrationId: v.id("sessionRegistrations"),
      personId: v.id("people"),
      weeklyStatus: v.union(
        v.literal("active"),
        v.literal("inactive"),
        v.literal("not_invited")
      ),
      inviteStatus: v.union(
        v.literal("invited"),
        v.literal("confirmed"),
        v.literal("declined"),
        v.literal("inactive"),
        v.literal("not_invited")
      ),
      inviteToken: v.optional(v.string()),
      respondedAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_registrationId", ["registrationId"])
      .index("by_personId", ["personId"])
      .index("by_inviteToken", ["inviteToken"]),

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
