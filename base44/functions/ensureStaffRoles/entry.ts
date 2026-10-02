// Server-side staff role management. Roles are assigned ONLY here — the
// frontend never sets them directly. Two invariants are enforced on the server:
//   • the console must always keep at least two super admins;
//   • the founder accounts can never be stripped of super admin (they re-bootstrap).
// Every change is audit-logged.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";

const SUPER_ADMINS = [
  "webdxb1@gmail.com",
  "vincentnogue2@gmail.com",
  "vincentnogue@yahoo.com",
];

const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN", "CATALOG_MANAGER", "CRAWLER_MANAGER", "FINANCE", "OPERATIONS", "SUPPORT"];

// The console must never be left with fewer than two super admins.
const MIN_SUPER_ADMINS = 2;

const lower = (value) => String(value || "").toLowerCase().trim();

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const admin = base44.asServiceRole;
    const email = lower(user.email);
    const isFounder = SUPER_ADMINS.includes(email);
    const body = await req.json().catch(() => ({}));

    const cleanList = (list) => (Array.isArray(list) ? list : []).map(lower).filter(Boolean);
    const assignEmails = [...cleanList(body.assign_emails), ...(body.assign_email ? [lower(body.assign_email)] : [])];
    const revokeEmails = cleanList(body.revoke_emails);
    const staffRole = String(body.staff_role || "");
    const isRequest = assignEmails.length > 0 || revokeEmails.length > 0;

    // Bootstrap: a designated founder account elevates itself, verified server-side.
    // Only when the call is not a role-management request, so the bulk actions
    // below stay reachable for founder accounts too.
    if (isFounder && !isRequest) {
      const users = await admin.entities.User.list(null, 500);
      const me = users.find((u) => lower(u.email) === email);
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

    if (user.role !== "admin" && !isFounder) return Response.json({ error: "Forbidden" }, { status: 403 });

    const users = await admin.entities.User.list(null, 500);
    const byEmail = new Map(users.map((u) => [lower(u.email), u]));
    const callerRow = byEmail.get(email);
    const callerIsSuper = isFounder || callerRow?.staff_role === "SUPER_ADMIN";

    if (assignEmails.length && !STAFF_ROLES.includes(staffRole)) {
      return Response.json({ error: "Unknown staff role" }, { status: 400 });
    }
    if (assignEmails.length && staffRole === "SUPER_ADMIN" && !callerIsSuper) {
      return Response.json({ error: "Only a super admin can appoint super admins" }, { status: 403 });
    }
    if (revokeEmails.length && !callerIsSuper) {
      return Response.json({ error: "Only a super admin can remove super admins" }, { status: 403 });
    }

    const assigned = [];
    const revoked = [];
    const errors = [];

    if (revokeEmails.length) {
      // Founder accounts re-elevate themselves on their next console visit, so
      // removing them would be meaningless — refuse explicitly instead.
      const blocked = revokeEmails.filter((e) => SUPER_ADMINS.includes(e));
      if (blocked.length) {
        return Response.json(
          { error: `Founder account(s) cannot be removed: ${blocked.join(", ")}` },
          { status: 400 }
        );
      }
      // Invariant: at least MIN_SUPER_ADMINS super admins must survive.
      const revokeSet = new Set(revokeEmails);
      const remaining = users.filter(
        (u) => u.staff_role === "SUPER_ADMIN" && !revokeSet.has(lower(u.email))
      );
      if (remaining.length < MIN_SUPER_ADMINS) {
        return Response.json(
          { error: `At least ${MIN_SUPER_ADMINS} super admins must remain — only ${remaining.length} would be left.` },
          { status: 400 }
        );
      }
    }

    for (const target of assignEmails) {
      const row = byEmail.get(target);
      if (!row) {
        errors.push(`${target}: not registered`);
        continue;
      }
      await admin.entities.User.update(row.id, {
        staff_role: staffRole,
        role: staffRole === "SUPER_ADMIN" || staffRole === "ADMIN" ? "admin" : row.role,
      });
      await admin.entities.AuditLog.create({
        actor_email: user.email,
        actor_id: user.id,
        action: "ROLE_ASSIGNMENT",
        target_type: "user",
        target_id: row.id,
        details: `${staffRole} assigned to ${target}`,
      });
      assigned.push(target);
    }

    for (const target of revokeEmails) {
      const row = byEmail.get(target);
      if (!row) {
        errors.push(`${target}: not registered`);
        continue;
      }
      await admin.entities.User.update(row.id, { staff_role: null, role: "user" });
      await admin.entities.AuditLog.create({
        actor_email: user.email,
        actor_id: user.id,
        action: "ROLE_ASSIGNMENT",
        target_type: "user",
        target_id: row.id,
        details: `SUPER_ADMIN removed from ${target}`,
      });
      revoked.push(target);
    }

    if (assigned.length || revoked.length || errors.length) {
      return Response.json({ ok: true, assigned, revoked, errors });
    }
    return Response.json({ ok: true, role: callerRow?.staff_role || "ADMIN" });
  } catch (error) {
    return Response.json({ error: error.message || "Role check failed" }, { status: 500 });
  }
}