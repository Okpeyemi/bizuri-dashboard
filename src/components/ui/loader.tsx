import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function Loader({ label = "Chargement...", className, size = 20 }: { label?: string; className?: string; size?: number }) {
  return (
    <div
      className={cn("flex h-[calc(100vh-20rem)] items-center justify-center gap-2 text-muted-foreground", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="animate-spin" style={{ width: size, height: size }} />
      <span className="sr-only">{label}</span>
    </div>
  )
}
