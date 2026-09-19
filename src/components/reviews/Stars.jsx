import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

// 1-5 star renderer, shared by customer and source reviews.
export default function Stars({ value = 0, className }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "w-4 h-4",
            i <= Math.round(value) ? "fill-badge-premium text-badge-premium" : "text-border-hairline"
          )}
        />
      ))}
    </span>
  );
}