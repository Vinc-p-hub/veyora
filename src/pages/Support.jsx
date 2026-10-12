import React, { useEffect, useState } from "react";
import { LifeBuoy, Loader2, Send, CheckCircle2 } from "lucide-react";
import { api } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import { useLang } from "@/lib/i18n";
import { useToast } from "@/components/ui/use-toast";
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

const TOPICS = ["order", "payment", "financing", "product", "delivery", "account", "other"];
const STATUS_STYLE = { OPEN: "text-amber-600", IN_PROGRESS: "text-accent-cyan", RESOLVED: "text-emerald-600", CLOSED: "text-text-muted" };

export default function Support() {
  const { t } = useLang();
  const { user } = useAuth();
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [topic, setTopic] = useState("other");
  const [orderNumber, setOrderNumber] = useState("");
  const [sending, setSending] = useState(false);
  const [tickets, setTickets] = useState([]);

  const loadTickets = () => {
    api.entities.SupportTicket.list("-created_date", 20).then(setTickets).catch(() => {});
  };
  useEffect(loadTickets, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSending(true);
    try {
      await api.entities.SupportTicket.create({
        subject: subject.trim(),
        message: message.trim(),
        email: user?.email,
        topic,
        order_number: orderNumber.trim() || undefined,
        status: "OPEN",
      });
      setSubject(""); setMessage(""); setOrderNumber("");
      toast({ description: t("support.submitted") });
      loadTickets();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl md:text-3xl flex items-center gap-2">
          <LifeBuoy className="w-6 h-6 text-accent-cyan" /> {t("support.title")}
        </h1>
      </div>

      {/* FAQ */}
      <div className="bg-surface-card border border-border-hairline rounded-xl p-5">
        <h2 className="font-display font-semibold mb-2">{t("support.faqTitle")}</h2>
        <Accordion type="single" collapsible>
          {[1, 2, 3, 4].map((n) => (
            <AccordionItem key={n} value={`q${n}`}>
              <AccordionTrigger className="text-sm text-left">{t(`faq.q${n}`)}</AccordionTrigger>
              <AccordionContent className="text-sm text-text-muted leading-relaxed">{t(`faq.a${n}`)}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      {/* Contact form */}
      <form onSubmit={submit} className="bg-surface-card border border-border-hairline rounded-xl p-5 space-y-4">
        <h2 className="font-display font-semibold">{t("support.contactTitle")}</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-text-muted">{t("support.topic")}</span>
            <select value={topic} onChange={(e) => setTopic(e.target.value)}
              className="mt-1 w-full bg-surface-primary border border-border-hairline rounded-lg px-3 py-2.5 text-sm">
              {TOPICS.map((tp) => <option key={tp} value={tp}>{t(`support.topic${tp.charAt(0).toUpperCase() + tp.slice(1)}`)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-text-muted">{t("support.orderNumber")}</span>
            <input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)}
              className="mt-1 w-full bg-surface-primary border border-border-hairline rounded-lg px-3 py-2.5 text-sm" />
          </label>
        </div>
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest text-text-muted">{t("support.subject")}</span>
          <input required value={subject} onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full bg-surface-primary border border-border-hairline rounded-lg px-3 py-2.5 text-sm" />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest text-text-muted">{t("support.message")}</span>
          <textarea required rows={4} value={message} onChange={(e) => setMessage(e.target.value)}
            className="mt-1 w-full bg-surface-primary border border-border-hairline rounded-lg px-3 py-2.5 text-sm resize-y" />
        </label>
        <button type="submit" disabled={sending}
          className="px-5 py-2.5 rounded-full bg-noon text-noon-fg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {t("support.submit")}
        </button>
      </form>

      {/* My tickets */}
      {tickets.length > 0 && (
        <div className="bg-surface-card border border-border-hairline rounded-xl p-5">
          <h2 className="font-display font-semibold mb-3">{t("support.myTickets")}</h2>
          <div className="space-y-2">
            {tickets.map((tk) => (
              <div key={tk.id} className="rounded-lg bg-surface-primary p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{tk.subject}</span>
                  <span className={cn("text-[10px] font-semibold uppercase shrink-0", STATUS_STYLE[tk.status] || "")}>{tk.status.replace(/_/g, " ")}</span>
                </div>
                {tk.reply && <p className="text-xs text-text-muted mt-1.5 border-t border-border-hairline pt-1.5"><CheckCircle2 className="w-3 h-3 inline me-1 text-accent-cyan" />{tk.reply}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}