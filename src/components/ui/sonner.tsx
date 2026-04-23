import {
  CircleCheck,
  Info,
  LoaderCircle,
  OctagonX,
  TriangleAlert,
} from "lucide-react"
import { Toaster as SonnerToaster } from "sonner"

type ToasterProps = React.ComponentProps<typeof SonnerToaster>

function Toaster({ ...props }: ToasterProps) {
  return (
    <SonnerToaster
      theme="light"
      position="top-right"
      duration={5000}
      closeButton
      className="toaster group"
      icons={{
        success: <CircleCheck className="h-4 w-4 text-success" />,
        info: <Info className="h-4 w-4 text-primary" />,
        warning: <TriangleAlert className="h-4 w-4 text-warning" />,
        error: <OctagonX className="h-4 w-4 text-destructive" />,
        loading: <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border/20 group-[.toaster]:shadow-sm",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted/60 group-[.toast]:text-muted-foreground",
          error:
            "group-[.toaster]:border-destructive/30 group-[.toast]:!duration-[8000ms]",
          success: "group-[.toaster]:border-success/30",
          warning:
            "group-[.toaster]:border-warning/30 group-[.toast]:!duration-[8000ms]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
