import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  getDashboardProjects,
  type DashboardProjectSummary,
} from "@/lib/dashboard-api"
import { getDashboardCookieHeader } from "@/lib/session"
import { NewProjectDialog } from "@/components/new-project-dialog"

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function getStatusLabel(status: DashboardProjectSummary["status"]): string {
  return status === "active" ? "Active" : "Inactive"
}

function getStatusVariant(status: DashboardProjectSummary["status"]): "default" | "outline" {
  return status === "active" ? "default" : "outline"
}

export default async function Page({
  searchParams,
}: {
  searchParams?: { created?: string; error?: string }
}) {
  const cookieHeader = await getDashboardCookieHeader()
  const projects = await getDashboardProjects(cookieHeader)

  const totalProjects = projects.length
  const created = searchParams?.created === "1"
  const errorMessage = searchParams?.error

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 md:px-6">
        {created ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">
            Project created. It now appears in the list below.
          </div>
        ) : null}
        {errorMessage ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            We could not create the project. {errorMessage}
          </div>
        ) : null}
      </div>

      <div className="px-4 md:px-6">
        <div className="rounded-3xl border border-border/70 bg-background/90 px-4 py-4 shadow-sm backdrop-blur md:px-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Projects
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                All projects in one place
              </h2>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                Browse the projects currently available in this control plane. Each card shows the
                status, database name, and recent activity at a glance.
              </p>
              <p className="text-sm font-medium text-foreground">
                {totalProjects === 1
                  ? "1 project is available right now."
                  : `${totalProjects} projects are available right now.`}
              </p>
            </div>
            <NewProjectDialog />
          </div>
        </div>
      </div>

      {totalProjects === 0 ? (
        <div className="px-4 md:px-6">
          <Card className="border-dashed bg-background/70 shadow-none">
            <CardHeader>
              <CardTitle>No projects yet</CardTitle>
              <CardDescription>
                There are no projects in this control plane right now. When projects are added,
                they will appear here with their current status and metadata.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 px-4 md:grid-cols-2 md:px-6 xl:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="border-border/70 bg-background/90 shadow-sm">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">{project.name}</CardTitle>
                    <CardDescription>{project.databaseName}</CardDescription>
                  </div>
                  <Badge variant={getStatusVariant(project.status)}>
                    {getStatusLabel(project.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="grid gap-1">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Slug
                  </span>
                  <span className="text-sm text-foreground">{project.slug}</span>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Active API keys
                  </span>
                  <span className="text-sm text-foreground">{project.apiKeyCount}</span>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Created
                  </span>
                  <span className="text-sm text-foreground">
                    {formatTimestamp(project.createdAt)}
                  </span>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Updated
                  </span>
                  <span className="text-sm text-foreground">
                    {formatTimestamp(project.updatedAt)}
                  </span>
                </div>
                {project.activeApiKeyPrefix ? (
                  <div className="grid gap-1">
                    <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Active key prefix
                    </span>
                    <span className="text-sm text-foreground">{project.activeApiKeyPrefix}</span>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
