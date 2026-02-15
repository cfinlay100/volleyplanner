import { cn } from "@/lib/utils";
import NextLink, { LinkProps } from "next/link";
import { forwardRef } from "react";

export const Link = forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement> &
    LinkProps & {
      children?: React.ReactNode;
    }
>(function Link({ className, children, ...props }, ref) {
  return (
    <NextLink
      className={cn("text-primary underline-offset-4 hover:underline", className)}
      ref={ref}
      {...props}
    >
      {children}
    </NextLink>
  );
});
