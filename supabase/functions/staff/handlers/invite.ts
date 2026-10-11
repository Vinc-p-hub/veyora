// Invite a user by e-mail (Supabase Auth). Admins only; granting "admin" needs a super admin.
import { createContext } from "../../_shared/runtime.ts";

export default async function handler(req: Request): Promise<Response> {
  const ctx = await createContext(req);
  if (!ctx.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const role = body.role === "admin" ? "admin" : "user";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Invalid email" }, { status: 400 });
  if (role === "admin" && ctx.user.staff_role !== "SUPER_ADMIN") {
    return Response.json({ error: "Only a super admin can invite an admin" }, { status: 403 });
  }
  const { data, error } = await ctx.db.auth.admin.inviteUserByEmail(email);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  if (role === "admin" && data?.user) {
    await ctx.db.from("profiles").upsert({ id: data.user.id, email, role: "admin", staff_role: "ADMIN" });
  }
  await ctx.admin.entities.AuditLog.create({
    actor_email: ctx.user.email, actor_id: ctx.user.id, action: "USER_INVITED",
    target_type: "user", target_id: email, details: `Invited ${email} as ${role}`,
  }).catch(() => {});
  return Response.json({ ok: true });
}
