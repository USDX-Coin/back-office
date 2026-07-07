import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

// USDX-27: modals are structured as Header (title + close X) / Body (scrolls) /
// Footer (actions). DialogContent is the scroll container — capped at the
// viewport height with ~1rem gutter on every side (`100dvh` accounts for mobile
// browser chrome), full-width again at ≥sm so callers' `max-w-*` takes over.
// DialogHeader/DialogFooter pin themselves via `position: sticky`. Compose as:
//   <DialogContent>
//     <DialogHeader><DialogTitle/><DialogDescription?/></DialogHeader>
//     <DialogBody> …scrollable content… </DialogBody>
//     <DialogFooter> …action buttons… </DialogFooter>   {/* optional */}
//   </DialogContent>
// For form modals, wrap <DialogBody> + <DialogFooter> in the <form>.
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // overflow-hidden: the BODY (DialogBody) is the scroll container, not
        // the modal as a whole. Header/footer are fixed-height flex items so
        // they pin naturally; body gets flex-1 + min-h-0 + overflow-y-auto.
        "fixed left-[50%] top-[50%] z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden rounded-lg bg-card shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:w-full",
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

// Top region: title + description + the close button. Pinned by flexbox
// (`shrink-0` inside DialogContent's `flex flex-col overflow-hidden`).
const DialogHeader = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "relative flex shrink-0 flex-col space-y-1.5 border-b border-border bg-card px-6 pb-4 pr-12 pt-5 text-left",
      className
    )}
    {...props}
  >
    {children}
    <DialogPrimitive.Close className="absolute right-3.5 top-3.5 rounded-sm p-0.5 text-muted-foreground opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
      <X className="h-4 w-4" />
      <span className="sr-only">Close</span>
    </DialogPrimitive.Close>
  </div>
)
DialogHeader.displayName = "DialogHeader"

// Body region — the ONLY scroll container in the modal. `min-h-0` lets it
// shrink below content size so `overflow-y-auto` actually engages inside the
// flex parent; `flex-1` claims the remaining height between header and footer.
const DialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-4", className)} {...props} />
)
DialogBody.displayName = "DialogBody"

// Bottom region: action buttons (stacked on mobile, row on ≥sm). Pinned by
// flexbox (`shrink-0`).
const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-card px-6 pb-6 pt-4 sm:flex-row sm:justify-end",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
