import React, { useCallback, useEffect, useState } from "react";
import { MailPlus, Search, Ban } from "lucide-react";
import { api } from "@/api/client";
import { cn } from "@/lib/utils";

// Customer-service review invitations — invite REAL buyers (by email) to
// share their own honest review. No review content is ever generated here.
const STATUS_COLOR = {
  PENDING: "text-amber-600",
  USED: "text-emerald-600",
  CANCELLED: "text-text-muted",
};

export default function InviteBuyersPanel() {
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [productId, setProductId] = useState(null);
  const [emails, setEmails] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [invitations, setInvitations] = useState([]);

  const load = useCallback(async () => {
    const [prods, invs] = await Promise.all([
      api.entities.Product.filter({ status: "PUBLISHED" }, "name", 200).catch(() => []),
      api.entities.ReviewInvitation.list("-created_date", 100).catch(() => []),
    ]);
    setProducts(prods);
    setInvitations(invs);
  }, []);

  useEffect(() => { load(); }, [load]);

  const selected = products.find((p) => p.id === productId) || null;
  const matches = q
    ? products
        .filter((p) => `${p.name} ${p.brand}`.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 8)
    : [];

  const invite = async () => {
    const list = emails
      .split(/[\n,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (!productId || list.length === 0) {
      setMsg("Pick a product and enter at least one email.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.functions.invoke("reviewInvite", { product_id: productId, emails: list });
      setMsg(
        `${res.data.invited} invitation(s) created. No email is sent yet — contact the buyer(s) directly with the product link for now.`
      );
      setEmails("");
      await load();
    } catch (e) {
      setMsg(e.response?.data?.error || e.message || "Invitation failed");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (inv) => {
    await api.entities.ReviewInvitation.update(inv.id, { status: "CANCELLED" });
    load();
  };

  return (
    <div className="space-y-4">
      {/* Invite form */}
      <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
        <h3 className="font-display font-semibold flex items-center gap-2">
          <MailPlus className="w-4 h-4 text-accent-cyan" /> Invite a buyer to review
        </h3>
        <p className="text-xs text-text-muted mt-1">
          Real buyers invited by customer service can write their own honest review (no purchase needed). They must
          sign in with the invited email — VEYRO never writes, edits or generates review content, and invited reviews
          never display the Verified Buyer badge. Email sending is not enabled yet: share the product link with the
          buyer directly.
        </p>
        <div className="mt-4 grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium">Product</label>
            <div className="relative mt-1">
              <Search className="w-4 h-4 absolute start-3 top-2.5 text-text-muted" />
              <input
                value={selected ? selected.name : q}
                onChange={(e) => { setQ(e.target.value); if (selected) setProductId(null); }}
                placeholder="Search a published product…"
                className="w-full ps-9 pe-3 py-2 bg-surface-card border border-border-hairline rounded-lg text-sm"
              />
            </div>
            {!selected && matches.length > 0 && (
              <div className="mt-1 border border-border-hairline rounded-lg divide-y divide-border-hairline max-h-48 overflow-y-auto">
                {matches.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setProductId(p.id); setQ(""); }}
                    className="w-full text-start px-3 py-2 text-xs hover:bg-surface-primary"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-text-muted"> · {p.brand}</span>
                  </button>
                ))}
              </div>
            )}
            {selected && (
              <p className="text-[11px] text-emerald-600 mt-1.5">Selected: {selected.name}</p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium">Buyer emails (comma or line separated, max 10)</label>
            <textarea
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              rows={3}
              placeholder="client1@example.com, client2@example.com"
              className="w-full mt-1 px-3 py-2 bg-surface-card border border-border-hairline rounded-lg text-sm"
            />
          </div>
        </div>
        <button
          onClick={invite}
          disabled={busy}
          className="mt-4 px-4 py-2 rounded-full bg-noon text-noon-fg text-sm font-semibold hover:opacity-90 disabled:opacity-40 flex items-center gap-2"
        >
          <MailPlus className="w-4 h-4" /> {busy ? "Sending…" : "Send invitation"}
        </button>
        {msg && <div className="mt-3 rounded-lg bg-surface-primary p-3 text-xs">{msg}</div>}
      </div>

      {/* Invitations list */}
      <div className="bg-surface-card border border-border-hairline rounded-lg p-5 overflow-x-auto">
        <h3 className="font-display font-semibold mb-3">Invitations ({invitations.length})</h3>
        {invitations.length === 0 ? (
          <p className="text-sm text-text-muted">No invitations sent yet.</p>
        ) : (
          <table className="w-full text-xs min-w-[700px]">
            <thead>
              <tr className="text-left text-text-muted border-b border-border-hairline">
                <th className="py-2 pr-3 font-medium">Buyer</th>
                <th className="py-2 pr-3 font-medium">Product</th>
                <th className="py-2 pr-3 font-medium">Invited by</th>
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => (
                <tr key={inv.id} className="border-b border-border-hairline last:border-0">
                  <td className="py-2.5 pr-3 text-mono">{inv.email}</td>
                  <td className="py-2.5 pr-3">{inv.product_name}</td>
                  <td className="py-2.5 pr-3 text-text-muted">{inv.invited_by}</td>
                  <td className="py-2.5 pr-3 text-text-muted">
                    {inv.created_date ? new Date(inv.created_date).toLocaleDateString() : ""}
                  </td>
                  <td className={cn("py-2.5 pr-3 font-medium", STATUS_COLOR[inv.status])}>{inv.status}</td>
                  <td className="py-2.5 text-right">
                    {inv.status === "PENDING" && (
                      <button
                        onClick={() => cancel(inv)}
                        className="px-2 py-1 rounded-md border border-border-hairline hover:border-red-400/40 text-red-600 inline-flex items-center gap-1"
                      >
                        <Ban className="w-3 h-3" /> Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}