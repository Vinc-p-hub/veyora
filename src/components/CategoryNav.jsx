import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutGrid, ChevronDown } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const CATS = [
  "Laptops", "Smartphones", "Tablets", "Headphones & Earbuds", "TVs & Monitors",
  "Cameras", "Gaming", "Smartwatches", "Audio", "Accessories", "Smart Home",
  "Networking", "Computer Components",
];

// Clean category navigation under the search bar: an "All categories"
// dropdown with the full grid on the left, and a tidy, contained scrollable
// strip of categories on the right — nothing overflows the viewport.
export default function CategoryNav() {
  const { t, tCat } = useLang();
  const { search, pathname } = useLocation();
  const catParam = new URLSearchParams(search).get("cat");
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white border-b border-border-hairline text-noon-fg">
      <div className="max-w-[1400px] mx-auto px-3 md:px-8 flex items-center h-11">
        {/* All categories dropdown */}
        <div className="relative shrink-0 h-full flex items-center me-2 md:me-4">
          <button
            onClick={() => setOpen((o) => !o)}
            className={cn(
              "flex items-center gap-1.5 text-[13px] font-semibold py-2.5 hover:text-accent-cyan transition no-tap-highlight",
              open && "text-accent-cyan"
            )}
          >
            <LayoutGrid className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{t("nav.categories")}</span>
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div className="absolute top-full start-0 mt-1 w-[280px] md:w-[340px] bg-white border border-border-hairline rounded-lg p-2 z-50 shadow-xl">
                <div className="grid grid-cols-2 gap-0.5">
                  {CATS.map((c) => (
                    <Link
                      key={c}
                      to={`/category?cat=${encodeURIComponent(c)}`}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "px-2.5 py-2 rounded-md text-[13px] hover:bg-surface-secondary transition",
                        catParam === c ? "bg-surface-secondary font-semibold text-accent-cyan" : "text-text-primary"
                      )}
                    >
                      {tCat(c)}
                    </Link>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="w-px h-5 bg-border-hairline shrink-0" />
        {/* Scrollable category strip — contained, never stretches the page */}
        <div className="flex-1 min-w-0 flex items-center gap-4 md:gap-6 overflow-x-auto scrollbar-hide text-[13px]">
          <Link
            to="/category"
            className={cn(
              "whitespace-nowrap py-2.5 border-b-2 -mb-px",
              !catParam && pathname === "/category" ? "border-noon-fg font-semibold" : "border-transparent text-text-muted hover:text-text-primary"
            )}
          >
            {t("header.allProducts")}
          </Link>
          {CATS.map((c) => (
            <Link
              key={c}
              to={`/category?cat=${encodeURIComponent(c)}`}
              className={cn(
                "whitespace-nowrap py-2.5 border-b-2 -mb-px",
                catParam === c ? "border-noon-fg font-semibold" : "border-transparent text-text-muted hover:text-text-primary"
              )}
            >
              {tCat(c)}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}