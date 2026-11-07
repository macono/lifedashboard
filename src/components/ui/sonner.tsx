"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

// shadcn's version reads the theme from next-themes; this app has no theme switcher, so it is fixed to light.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
