"use client"
import * as React from "react"
import { cn } from "@/lib/utils"

type SwitchProps = {
  checked?: boolean
  defaultChecked?: boolean
  disabled?: boolean
  onCheckedChange?: (checked: boolean) => void
  id?: string
  className?: string
}

export function Switch({ checked, defaultChecked, disabled, onCheckedChange, id, className }: SwitchProps) {
  const [internal, setInternal] = React.useState<boolean>(defaultChecked ?? false)
  const isControlled = typeof checked === "boolean"
  const value = isControlled ? (checked as boolean) : internal
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={value}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={() => {
        if (disabled) return
        const next = !value
        if (!isControlled) setInternal(next)
        onCheckedChange?.(next)
      }}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
        value ? "bg-primary" : "bg-muted",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        className
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform",
          value ? "translate-x-5" : "translate-x-1"
        )}
      />
    </button>
  )
}
