import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[88px] w-full min-w-0 rounded-md border border-input bg-card px-3 py-2.5 text-base text-foreground shadow-xs transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/15 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none read-only:bg-muted read-only:text-muted-foreground read-only:shadow-none read-only:focus-visible:border-input read-only:focus-visible:ring-0 leading-relaxed",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
