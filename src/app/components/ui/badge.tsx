import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 transition-all overflow-hidden [box-shadow:var(--shadow-raised)]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive text-destructive-foreground [a&]:hover:bg-destructive/90",
        success:
          "bg-[var(--success-bg)] text-[var(--success-text)] [box-shadow:var(--shadow-success)] [a&]:hover:opacity-90",
        warning:
          "bg-[var(--warning-bg)] text-[var(--warning-text)] [box-shadow:var(--shadow-warning)] [a&]:hover:opacity-90",
        error:
          "bg-[var(--error-bg)] text-[var(--error-text)] [box-shadow:var(--shadow-error)] [a&]:hover:opacity-90",
        info:
          "bg-[var(--info-bg)] text-[var(--info-text)] [box-shadow:var(--shadow-info)] [a&]:hover:opacity-90",
        outline:
          "text-foreground bg-background [a&]:hover:bg-accent [a&]:hover:text-accent-foreground border-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
