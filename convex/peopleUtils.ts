import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function upsertPerson(
  ctx: MutationCtx,
  input: {
    name: string;
    email: string;
    clerkUserId?: string;
  }
): Promise<Id<"people">> {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  if (!name) {
    throw new Error("Name is required.");
  }
  if (!isValidEmail(email)) {
    throw new Error("Invalid email.");
  }

  const existingByEmail = await ctx.db
    .query("people")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
  if (existingByEmail) {
    await ctx.db.patch(existingByEmail._id, {
      name,
      ...(input.clerkUserId ? { clerkUserId: input.clerkUserId } : {}),
    });
    return existingByEmail._id;
  }

  if (input.clerkUserId) {
    const existingByClerk = await ctx.db
      .query("people")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", input.clerkUserId))
      .first();
    if (existingByClerk) {
      await ctx.db.patch(existingByClerk._id, { name, email });
      return existingByClerk._id;
    }
  }

  return await ctx.db.insert("people", {
    name,
    email,
    clerkUserId: input.clerkUserId,
    createdAt: Date.now(),
  });
}

export async function getOrCreatePersonFromIdentity(
  ctx: MutationCtx,
  identity: { subject: string; email?: string; name?: string }
) {
  const email = normalizeEmail(identity.email ?? "");
  if (!email) {
    throw new Error("Signed in account is missing an email.");
  }
  return await upsertPerson(ctx, {
    name: identity.name ?? "Player",
    email,
    clerkUserId: identity.subject,
  });
}

export async function getPersonByEmail(ctx: QueryCtx, email: string) {
  return await ctx.db
    .query("people")
    .withIndex("by_email", (q) => q.eq("email", normalizeEmail(email)))
    .first();
}
