"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & {
    startIcon?: React.ReactNode;
    endIcon?: React.ReactNode;
  }
>(({ className, startIcon, endIcon, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      (startIcon || endIcon) &&
        "relative h-[22px] w-14 text-onSurface-default-secondary data-[state=checked]:bg-surface-default-tertiary data-[state=unchecked]:bg-surface-default-tertiary",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-surface-default-primary shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
        (startIcon || endIcon) &&
          "h-[18px] w-[26px] data-[state=checked]:translate-x-[26px]",
      )}
    />
    {startIcon && (
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-[26px] items-center justify-center"
      >
        {startIcon}
      </span>
    )}
    {endIcon && (
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-[26px] items-center justify-center"
      >
        {endIcon}
      </span>
    )}
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
