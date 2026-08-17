import { redirect } from "next/navigation"

import { LoginForm } from "@/components/login-form"
import { getDashboardRootUser } from "@/lib/session"

export default async function Page() {
  const rootUser = await getDashboardRootUser()

  if (rootUser) {
    redirect("/dashboard")
  }

  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(15,23,42,0.12),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] p-6 md:p-10">
      <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.35)_50%,transparent_100%)] opacity-70" />
      <div className="relative w-full max-w-md">
        <LoginForm />
      </div>
    </main>
  )
}
