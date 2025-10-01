"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type TabsContextValue = {
  value: string
  setValue: (v: string) => void
}

const TabsCtx = React.createContext<TabsContextValue | null>(null)

type TabsProps = React.PropsWithChildren<{
  defaultValue: string
  value?: string
  onValueChange?: (v: string) => void
  className?: string
}>

function Tabs({ defaultValue, value: controlled, onValueChange, className, children }: TabsProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const value = controlled ?? inner
  const setValue = React.useCallback(
    (v: string) => {
      if (onValueChange) onValueChange(v)
      if (controlled === undefined) setInner(v)
    },
    [controlled, onValueChange]
  )
  return (
    <TabsCtx.Provider value={{ value, setValue }}>
      <div className={className}>{children}</div>
    </TabsCtx.Provider>
  )
}

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("bg-muted text-muted-foreground inline-flex h-10 items-center justify-center rounded-md p-1", className)}
      {...props}
    />
  )
)
TabsList.displayName = "TabsList"

type TabsTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(({ className, value, ...props }, ref) => {
  const ctx = React.useContext(TabsCtx)
  const active = ctx?.value === value
  return (
    <button
      ref={ref}
      data-state={active ? "active" : "inactive"}
      onClick={() => ctx?.setValue(value)}
      className={cn(
        "ring-offset-background focus-visible:ring-ring data-[state=active]:bg-background data-[state=active]:text-foreground inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
})
TabsTrigger.displayName = "TabsTrigger"

type TabsContentProps = React.HTMLAttributes<HTMLDivElement> & { value: string }
const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(({ className, value, ...props }, ref) => {
  const ctx = React.useContext(TabsCtx)
  const hidden = ctx?.value !== value
  return (
    <div
      ref={ref}
      hidden={hidden}
      className={cn("ring-offset-background focus-visible:ring-ring mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2", className)}
      {...props}
    />
  )
})
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }
