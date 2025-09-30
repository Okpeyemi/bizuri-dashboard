"use client"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"

export function RegisterForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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
    const role = (fd.get("role") || "").toString()

    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }
    if (!full_name || !business_email || !company_name || !password || !role) {
      setError("Please fill all required fields")
      return
    }

    try {
      setLoading(true)
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name, business_email, company_name, password, role }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Registration failed")
      }
      setSuccess("Account created. You can now log in.")
      setTimeout(() => router.push("/login"), 800)
      form.reset()
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
          <Input id="password" name="password" type="password" required />
        </div>
        <div className="grid gap-3">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" name="confirm" type="password" required />
        </div>
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
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating account..." : "Sign up"}
        </Button>
        <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
          <span className="bg-background text-muted-foreground relative z-10 px-2">
            Or continue with
          </span>
        </div>
        <Button variant="outline" className="w-full">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path
              d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
              fill="currentColor"
            />
          </svg>
          Sign up with GitHub
        </Button>
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
