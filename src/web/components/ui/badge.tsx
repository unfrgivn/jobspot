import * as React from "react";
import { cn } from "../../lib/utils";

const badgeVariants = {
  default: "bg-primary text-primary-foreground hover:bg-primary/80",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/80",
  outline: "text-foreground border",
  wishlist: "bg-wishlist/20 text-wishlist border border-wishlist/30",
  applied: "bg-applied/20 text-applied border border-applied/30",
  interviewing: "bg-interviewing/20 text-interviewing border border-interviewing/30",
  offer: "bg-offer/20 text-offer border border-offer/30",
  rejected: "bg-rejected/20 text-rejected border border-rejected/30",
  withdrawn: "bg-withdrawn/20 text-withdrawn border border-withdrawn/30",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof badgeVariants;
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        badgeVariants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
