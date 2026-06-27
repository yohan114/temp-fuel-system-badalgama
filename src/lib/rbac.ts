import { requireUser } from "./auth";

const MATRIX = {
  ADMIN: new Set(["create", "update", "delete", "approve", "manage", "allocate"]),
  ALLOCATOR: new Set(["allocate"]),
  USER: new Set(["create"]),
  WORKSHOP: new Set(["create"]),
  SITE_PUMP: new Set(["create"]),
};

export type RBACAction = "create" | "update" | "delete" | "approve" | "manage" | "allocate";

// Roles whose data view is restricted to a single project/site.
const PROJECT_SCOPED_ROLES = new Set(["USER", "SITE_PUMP"]);

export function isProjectScoped(role: string): boolean {
  return PROJECT_SCOPED_ROLES.has(role);
}

// Returns the projectId a given actor should be scoped to, or null for global roles.
export function scopedProjectId(actor: { role: string; projectId: string | null }): string | null {
  return isProjectScoped(actor.role) && actor.projectId ? actor.projectId : null;
}

export async function assertCan(action: RBACAction) {
  const user = await requireUser();
  const roleActions = MATRIX[user.role as keyof typeof MATRIX];
  if (!roleActions || !roleActions.has(action)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}
