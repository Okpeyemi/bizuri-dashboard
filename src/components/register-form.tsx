"use client"
import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"

export function RegisterForm({
  className,
  fixedRole,
  ...props
}: React.ComponentProps<"form"> & { fixedRole?: "super_admin" | "business_admin" | "business_members" }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const form = e.currentTarget
    const fd = new FormData(form)

    const full_name = (fd.get("full_name") || "").toString().trim()
    const business_email = (fd.get("business_email") || "").toString().trim().toLowerCase()
    const company_name = (fd.get("company_name") || "").toString().trim()
    const password = (fd.get("password") || "").toString()
    const confirm = (fd.get("confirm") || "").toString()
    const role = fixedRole || (fd.get("role") || "").toString()
    const company_logo_file = fd.get("company_logo") as File | null

    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }
    if (!full_name || !business_email || !company_name || !password || (!fixedRole && !role)) {
      setError("Please fill all required fields")
      return
    }

    try {
      setLoading(true)
      // Submit as multipart/form-data so backend can optionally handle file upload
      const send = new FormData()
      send.set("full_name", full_name)
      send.set("business_email", business_email)
      send.set("company_name", company_name)
      send.set("password", password)
      send.set("role", role)
      if (company_logo_file instanceof File) {
        send.set("company_logo", company_logo_file)
      }
      const res = await fetch("/api/register", { method: "POST", body: send })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Registration failed")
      }
      setSuccess("Account created. You can now log in.")
      setTimeout(() => router.push("/login"), 800)
      form.reset()
      setLogoPreview(null)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong"
      setError(message)
    } finally {
      setLoading(false)
    }
  }
  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={onSubmit} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="text-muted-foreground text-sm text-balance">
          Enter your details below to create your account
        </p>
      </div>
      <div className="grid gap-6">
        <div className="grid gap-3">
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" name="full_name" type="text" placeholder="John Doe" required />
        </div>
        <div className="grid gap-3">
          <Label htmlFor="business_email">Business email</Label>
          <Input id="business_email" name="business_email" type="email" placeholder="ceo@acme.com" required />
        </div>
        <div className="grid gap-3">
          <Label htmlFor="company_name">Company name</Label>
          <Input id="company_name" name="company_name" type="text" placeholder="Acme Inc." required />
        </div>
        <div className="grid gap-3">
          <Label htmlFor="password">Password</Label>
          <div className="flex items-center gap-2">
            <Input id="password" name="password" type={showPw ? "text" : "password"} required />
            <button
              type="button"
              className="border-input hover:bg-accent hover:text-accent-foreground inline-flex h-10 w-10 items-center justify-center rounded-md border text-sm"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        <div className="grid gap-3">
          <Label htmlFor="confirm">Confirm password</Label>
          <div className="flex items-center gap-2">
            <Input id="confirm" name="confirm" type={showConfirm ? "text" : "password"} required />
            <button
              type="button"
              className="border-input hover:bg-accent hover:text-accent-foreground inline-flex h-10 w-10 items-center justify-center rounded-md border text-sm"
              onClick={() => setShowConfirm((s) => !s)}
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        <div className="grid gap-3">
          <Label htmlFor="company_logo">Company logo (optional)</Label>
          <input
            id="company_logo"
            name="company_logo"
            type="file"
            accept="image/*"
            className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground hover:file:bg-primary/90"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) {
                const url = URL.createObjectURL(f)
                setLogoPreview((prev) => {
                  if (prev) URL.revokeObjectURL(prev)
                  return url
                })
              } else {
                setLogoPreview(null)
              }
            }}
          />
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoPreview} alt="Logo preview" className="h-12 w-12 rounded object-cover" />
          ) : null}
        </div>
        {fixedRole ? null : (
          <div className="grid gap-3">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              name="role"
              required
              className="bg-background text-foreground border-input focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 h-10 w-full rounded-md border px-3 py-2 text-sm"
              defaultValue="business_members"
            >
              <option value="super_admin">Super Admin</option>
              <option value="business_admin">Business Admin</option>
              <option value="business_members">Business Member</option>
            </select>
          </div>
        )}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating account..." : "Sign up"}
        </Button>
        {/* Removed social signup */}
      </div>
      {error ? (
        <p className="text-destructive text-sm" role="alert">{error}</p>
      ) : null}
      {success ? (
        <p className="text-green-600 text-sm" role="status">{success}</p>
      ) : null}
      <div className="text-center text-sm">
        Already have an account?{" "}
        <a href="/login" className="underline underline-offset-4">
          Log in
        </a>
      </div>
    </form>
  )
}
