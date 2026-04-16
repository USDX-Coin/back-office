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
        error: <OctagonX className="h-4 w-4 text-error" />,
        loading: <LoaderCircle className="h-4 w-4 animate-spin text-on-surface-variant" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-surface-container-lowest group-[.toaster]:text-on-surface group-[.toaster]:border-outline-variant/20 group-[.toaster]:shadow-ambient",
          description: "group-[.toast]:text-on-surface-variant",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-on-primary",
          cancelButton:
            "group-[.toast]:bg-surface-container group-[.toast]:text-on-surface-variant",
          error:
            "group-[.toaster]:border-error/30 group-[.toast]:!duration-[8000ms]",
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
