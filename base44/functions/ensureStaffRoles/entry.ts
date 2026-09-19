// Server-side staff role assignment. The three bootstrap SUPER_ADMIN accounts are
// verified against the authenticated user's email ON THE SERVER — a frontend email
// match is never sufficient. Every assignment is audit-logged.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

const SUPER_ADMINS = [
  "webdxb1@gmail.com",
  "vincentnogue2@gmail.com",
  "vincentnogue@yahoo.com",
];

const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN", "CATALOG_MANAGER", "CRAWLER_MANAGER", "FINANCE", "OPERATIONS", "SUPPORT"];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const email = String(user.email || "").toLowerCase();
    const admin = base44.asServiceRole;

    // Bootstrap: one of the three designated accounts elevates itself, verified server-side.
    if (SUPER_ADMINS.includes(email)) {
      const users = await admin.entities.User.list(null, 500);
      const me = users.find((u) => String(u.email || "").toLowerCase() === email);
      if (!me) return Response.json({ error: "User record not found" }, { status: 404 });
      if (me.role !== "admin" || me.staff_role !== "SUPER_ADMIN") {
        await admin.entities.User.update(me.id, { role: "admin", staff_role: "SUPER_ADMIN" });
        await admin.entities.AuditLog.create({
          actor_email: email,
          actor_id: me.id,
          action: "ROLE_ASSIGNMENT",
          target_type: "user",
          target_id: me.id,
          details: "SUPER_ADMIN bootstrap (server-verified email)",
        });
        return Response.json({ ok: true, assigned: true, role: "SUPER_ADMIN", reload: true });
      }
      return Response.json({ ok: true, assigned: false, role: "SUPER_ADMIN" });
    }

    // Existing admin (or super admin) can assign staff roles to other registered users.
    if (user.role === "admin") {
      const body = await req.json().catch(() => ({}));
      const assignEmail = String(body.assign_email || "").toLowerCase().trim();
      const staffRole = String(body.staff_role || "");
      if (assignEmail && STAFF_ROLES.includes(staffRole)) {
        const users = await admin.entities.User.list(null, 500);
        const target = users.find((u) => String(u.email || "").toLowerCase() === assignEmail);
        if (!target) return Response.json({ error: "User not registered" }, { status: 404 });
        await admin.entities.User.update(target.id, {
          staff_role: staffRole,
          role: staffRole === "SUPER_ADMIN" || staffRole === "ADMIN" ? "admin" : target.role,
        });
        await admin.entities.AuditLog.create({
          actor_email: email,
          actor_id: user.id,
          action: "ROLE_ASSIGNMENT",
          target_type: "user",
          target_id: target.id,
          details: `${staffRole} assigned to ${assignEmail}`,
        });
        return Response.json({ ok: true, assigned: true, role: staffRole });
      }
      return Response.json({ ok: true, role: user.staff_role || "ADMIN" });
    }

    return Response.json({ error: "Forbidden" }, { status: 403 });
  } catch (error) {
    return Response.json({ error: error.message || "Role check failed" }, { status: 500 });
  }
}