import { redirect } from "next/navigation"

import { LoginForm } from "@/components/login-form"
import { getDashboardRootUser } from "@/lib/session"

export default async function Page() {
  const rootUser = await getDashboardRootUser()

  if (rootUser) {
    redirect("/dashboard")
  }

  return (
    <main className="relative flex min-h-dvh w-full overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(15,23,42,0.12),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] p-6 md:p-10">
      <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.35)_50%,transparent_100%)] opacity-70" />
      <div className="relative grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="flex flex-col gap-6 text-slate-900">
          <div className="inline-flex w-fit items-center rounded-full border border-slate-300/80 bg-white/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600 shadow-sm backdrop-blur">
            SuperGoose Control Plane
          </div>
          <div className="space-y-5">
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-balance text-slate-950 md:text-6xl">
              Root access for every project database.
            </h1>
            <p className="max-w-xl text-base leading-7 text-slate-600 md:text-lg">
              Sign in with your root username and password to manage clusters, inspect projects, and rotate API keys.
            </p>
          </div>
          <div className="grid max-w-2xl gap-3 text-sm text-slate-600 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur">
              <p className="font-medium text-slate-900">Root users only</p>
              <p className="mt-1 leading-6">No email, no OAuth, just the credentials stored in the control plane.</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur">
              <p className="font-medium text-slate-900">Cookie session</p>
              <p className="mt-1 leading-6">A successful sign in creates a dashboard session cookie for future visits.</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur">
              <p className="font-medium text-slate-900">Fast handoff</p>
              <p className="mt-1 leading-6">Once authenticated, you land directly in the dashboard.</p>
            </div>
          </div>
        </section>
        <div className="w-full max-w-md lg:ml-auto">
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
