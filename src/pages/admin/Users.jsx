import React, { useCallback, useEffect, useState } from "react";
import { Users as UsersIcon, UserPlus, Shield } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN", "CATALOG_MANAGER", "CRAWLER_MANAGER", "FINANCE", "OPERATIONS", "SUPPORT"];

// User & permission management. Staff roles are assigned ONLY through the
// server-side ensureStaffRoles function — the client never sets roles directly.
export default function Users() {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignEmail, setAssignEmail] = useState("");
  const [assignRole, setAssignRole] = useState("CATALOG_MANAGER");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await base44.entities.User.list("-created_date", 200));
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const assign = async () => {
    if (!assignEmail.trim()) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke("ensureStaffRoles", {
        assign_email: assignEmail.trim(),
        staff_role: assignRole,
      });
      toast({ description: res.data?.error ? `Error: ${res.data.error}` : `Role ${assignRole} assigned to ${assignEmail}.` });
      setAssignEmail("");
      await load();
    } catch (e) {
      toast({ description: e.response?.data?.error || "Assignment failed — user must be registered first." });
    } finally {
      setBusy(false);
    }
  };

  const invite = async () => {
    if (!inviteEmail.trim()) return;
    setBusy(true);
    try {
      await base44.users.inviteUser(inviteEmail.trim(), inviteRole);
      toast({ description: `Invitation sent to ${inviteEmail}.` });
      setInviteEmail("");
    } catch (e) {
      toast({ description: e.response?.data?.error || "Invitation failed." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="font-display font-bold text-xl md:text-2xl flex items-center gap-2">
        <UsersIcon className="w-5 h-5 text-accent-cyan" /> Users & permissions ({users.length})
      </h1>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-surface-card border border-border-hairline rounded-lg p-4 space-y-3">
          <h3 className="font-display font-semibold text-sm flex items-center gap-2"><Shield className="w-4 h-4 text-accent-cyan" /> Assign staff role</h3>
          <p className="text-[11px] text-text-muted">Server-verified assignment. SUPER_ADMIN/ADMIN also grant full console access.</p>
          <input value={assignEmail} onChange={(e) => setAssignEmail(e.target.value)} placeholder="user@example.com"
            className="w-full bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm" />
          <select value={assignRole} onChange={(e) => setAssignRole(e.target.value)}
            className="w-full bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm">
            {STAFF_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button onClick={assign} disabled={busy} className="w-full py-2 rounded-lg bg-noon text-noon-fg text-sm font-semibold disabled:opacity-40">Assign</button>
        </div>
        <div className="bg-surface-card border border-border-hairline rounded-lg p-4 space-y-3">
          <h3 className="font-display font-semibold text-sm flex items-center gap-2"><UserPlus className="w-4 h-4 text-accent-cyan" /> Invite a user</h3>
          <p className="text-[11px] text-text-muted">Adds a customer or admin account by email invitation.</p>
          <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="new.user@example.com"
            className="w-full bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm" />
          <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
            className="w-full bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm">
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          <button onClick={invite} disabled={busy} className="w-full py-2 rounded-lg border border-border-hairline text-sm font-semibold hover:border-accent-cyan/40 disabled:opacity-40">Send invitation</button>
        </div>
      </div>

      {loading ? (
        <div className="h-32 bg-surface-card rounded-lg animate-pulse" />
      ) : (
        <div className="bg-surface-card border border-border-hairline rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-text-muted border-b border-border-hairline">
                <th className="py-2.5 px-4">User</th><th className="py-2.5 px-4">Role</th><th className="py-2.5 px-4">Staff role</th><th className="py-2.5 px-4">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border-hairline last:border-0">
                  <td className="py-2.5 px-4">
                    <div className="font-medium">{u.full_name || "—"}</div>
                    <div className="text-xs text-text-muted">{u.email}{u.id === me?.id && " (you)"}</div>
                  </td>
                  <td className="py-2.5 px-4">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded font-medium",
                      u.role === "admin" ? "bg-noon text-noon-fg" : "bg-surface-secondary text-text-muted")}>{u.role}</span>
                  </td>
                  <td className="py-2.5 px-4 text-xs text-mono">{u.staff_role || "—"}</td>
                  <td className="py-2.5 px-4 text-xs text-text-muted">{new Date(u.created_date).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}