import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, CreditCard, LifeBuoy, MapPin, Globe, Check, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useLang, LANGUAGES } from "@/lib/i18n";
import { useRegion } from "@/lib/RegionContext";
import { useToast } from "@/components/ui/use-toast";

const EMPTY_ADDRESS = { label: "", name: "", street: "", city: "", country: "", phone: "" };

export default function Profile() {
  const { user } = useAuth();
  const { t, lang, setLang } = useLang();
  const { countryCode, setCountryCode, country, countries, currency } = useRegion();
  const { toast } = useToast();
  const [me, setMe] = useState(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [addresses, setAddresses] = useState([]);
  const [newAddress, setNewAddress] = useState(EMPTY_ADDRESS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.auth.me().then((data) => {
      setMe(data);
      setFullName(data.full_name || "");
      setPhone(data.phone || "");
      setAddresses(Array.isArray(data.addresses) ? data.addresses : []);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({ full_name: fullName, phone, addresses });
      toast({ description: t("profile.savedMsg") });
    } finally {
      setSaving(false);
    }
  };

  const addAddress = () => {
    if (!newAddress.name || !newAddress.street || !newAddress.city) return;
    const list = [...addresses, { ...newAddress, country: newAddress.country || countryCode }];
    setAddresses(list);
    setNewAddress(EMPTY_ADDRESS);
    base44.auth.updateMe({ addresses: list }).then(() => toast({ description: t("profile.savedMsg") }));
  };

  const removeAddress = (i) => {
    const list = addresses.filter((_, idx) => idx !== i);
    setAddresses(list);
    base44.auth.updateMe({ addresses: list }).then(() => toast({ description: t("profile.savedMsg") }));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl md:text-3xl">{t("profile.title")}</h1>
        <p className="text-xs text-text-muted mt-1">{user?.email}</p>
      </div>

      {/* Account shortcuts */}
      <div className="grid grid-cols-3 gap-3">
        <Link to="/wishlist" className="flex flex-col items-center gap-1.5 p-4 rounded-xl bg-surface-card border border-border-hairline hover:border-accent-cyan/40 transition">
          <Heart className="w-5 h-5 text-accent-cyan" />
          <span className="text-xs font-medium">{t("profile.wishlist")}</span>
        </Link>
        <Link to="/payment-methods" className="flex flex-col items-center gap-1.5 p-4 rounded-xl bg-surface-card border border-border-hairline hover:border-accent-cyan/40 transition">
          <CreditCard className="w-5 h-5 text-accent-cyan" />
          <span className="text-xs font-medium">{t("payment.title")}</span>
        </Link>
        <Link to="/support" className="flex flex-col items-center gap-1.5 p-4 rounded-xl bg-surface-card border border-border-hairline hover:border-accent-cyan/40 transition">
          <LifeBuoy className="w-5 h-5 text-accent-cyan" />
          <span className="text-xs font-medium">{t("profile.support")}</span>
        </Link>
      </div>

      {/* Contact + preferences */}
      <div className="bg-surface-card border border-border-hairline rounded-xl p-5 space-y-4">
        <h2 className="font-display font-semibold flex items-center gap-2"><MapPin className="w-4 h-4 text-accent-cyan" />{t("profile.contact")}</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-text-muted">{t("profile.fullName")}</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full bg-surface-primary border border-border-hairline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent-cyan/50" />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-text-muted">{t("profile.email")}</span>
            <input value={user?.email || ""} disabled
              className="mt-1 w-full bg-surface-primary border border-border-hairline rounded-lg px-3 py-2.5 text-sm text-text-muted" />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-text-muted">{t("profile.phone")}</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full bg-surface-primary border border-border-hairline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent-cyan/50" />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-text-muted"><Globe className="w-3 h-3 inline" /> {t("profile.language")}</span>
            <select value={lang} onChange={(e) => setLang(e.target.value)}
              className="mt-1 w-full bg-surface-primary border border-border-hairline rounded-lg px-3 py-2.5 text-sm focus:outline-none">
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className="text-[10px] uppercase tracking-widest text-text-muted">{t("profile.countryCurrency")}</span>
            <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)}
              className="mt-1 w-full bg-surface-primary border border-border-hairline rounded-lg px-3 py-2.5 text-sm focus:outline-none">
              {countries.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name} — {c.currency}</option>)}
            </select>
            <span className="text-[11px] text-text-muted mt-1 block">{country.flag} {country.name} · {currency.code} {currency.symbol}</span>
          </label>
        </div>
        <button onClick={save} disabled={saving}
          className="px-5 py-2.5 rounded-lg bg-noon text-noon-fg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {t("profile.save")}
        </button>
      </div>

      {/* Addresses */}
      <div className="bg-surface-card border border-border-hairline rounded-xl p-5 space-y-4">
        <h2 className="font-display font-semibold">{t("profile.addresses")}</h2>
        {addresses.length === 0 && <p className="text-sm text-text-muted">{t("profile.noAddresses")}</p>}
        <div className="space-y-2">
          {addresses.map((a, i) => (
            <div key={i} className="flex items-start justify-between gap-3 rounded-lg bg-surface-primary p-3">
              <div className="text-sm">
                <div className="font-medium">{a.label && <span className="text-[10px] uppercase text-text-muted me-1.5">{a.label}</span>}{a.name}</div>
                <div className="text-text-muted text-xs mt-0.5">{a.street}, {a.city}, {a.country} {a.phone ? `· ${a.phone}` : ""}</div>
              </div>
              <button onClick={() => removeAddress(i)} className="text-xs text-red-600 hover:underline shrink-0">{t("common.remove")}</button>
            </div>
          ))}
        </div>
        <div className="border-t border-border-hairline pt-4 grid md:grid-cols-2 gap-3">
          <input placeholder={t("profile.label")} value={newAddress.label} onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
            className="bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm" />
          <input placeholder={t("profile.fullName")} value={newAddress.name} onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
            className="bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm" />
          <input placeholder={t("profile.street")} value={newAddress.street} onChange={(e) => setNewAddress({ ...newAddress, street: e.target.value })}
            className="bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm md:col-span-2" />
          <input placeholder={t("profile.city")} value={newAddress.city} onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
            className="bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm" />
          <select value={newAddress.country} onChange={(e) => setNewAddress({ ...newAddress, country: e.target.value })}
            className="bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm">
            <option value="">{t("profile.country")}…</option>
            {countries.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
          </select>
          <button onClick={addAddress}
            className="px-4 py-2 rounded-lg border border-border-hairline text-sm font-medium hover:border-accent-cyan/40 transition md:col-span-2">
            + {t("profile.addAddress")}
          </button>
        </div>
      </div>
    </div>
  );
}