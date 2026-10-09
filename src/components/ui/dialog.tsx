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
      "fixed inset-0 z-50 bg-[rgb(17_24_39/0.45)] data-[state=open]:animate-tirai-masuk data-[state=closed]:animate-tirai-keluar",
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
// For form modals, wrap <DialogBody> + <DialogFooter> in the <form> — and give
// that form `className="flex min-h-0 flex-1 flex-col"`. Any element that sits
// BETWEEN DialogContent and DialogBody must forward the height limit, or the
// chain breaks there: DialogBody's `flex-1 min-h-0 overflow-y-auto` only works
// when its parent is a flex column that may shrink. A form without those
// classes renders fine until the content outgrows the viewport, and then the
// last fields and the footer are clipped with no way to reach them (USDX-681).
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
        "fixed left-[50%] top-[50%] z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden rounded-[12px] border border-border bg-card text-card-foreground shadow-[0_24px_48px_-12px_rgb(16_24_40/0.22),0_4px_12px_rgb(16_24_40/0.06)] sm:w-full data-[state=open]:animate-panel-masuk data-[state=closed]:animate-panel-keluar",
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
      "relative flex shrink-0 flex-col gap-1 border-b border-border bg-card px-6 pb-4 pr-14 pt-5 text-left",
      className
    )}
    {...props}
  >
    {children}
    <DialogPrimitive.Close className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:pointer-events-none">
      <X className="h-4 w-4" />
      <span className="sr-only">Tutup dialog</span>
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
  <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-5", className)} {...props} />
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
      "flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-card px-6 py-4 sm:flex-row sm:items-center sm:justify-end",
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
      "text-lg font-semibold leading-snug tracking-tight text-foreground",
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
    className={cn("text-base leading-relaxed text-muted-foreground", className)}
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
