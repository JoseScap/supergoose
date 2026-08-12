import type * as React from 'react';
import { ArrowRight, Database, KeyRound, BookOpen } from 'lucide-react';
import type { DashboardProjectSummary } from '@/lib/dashboard-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ProjectDashboardProps {
  project: DashboardProjectSummary;
  onGenerateFirstApiKey: () => Promise<void> | void;
  onOpenExplorer: () => void;
  onOpenApiKeys: () => void;
  onOpenDocs: () => void;
}

export function ProjectDashboard({
  project,
  onGenerateFirstApiKey,
  onOpenExplorer,
  onOpenApiKeys,
  onOpenDocs
}: ProjectDashboardProps): React.JSX.Element {
  const hasKeys = project.apiKeyCount > 0;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{project.name}</h1>
        <p className="text-sm text-muted-foreground">
          {hasKeys ? 'Project dashboard and data explorer access are available.' : 'Generate the first API key to unlock external access.'}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="bg-emerald-50/80 xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4 text-primary" />
              Project overview
            </CardTitle>
            <CardDescription>Metadata only dashboard entry for {project.slug}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-white/75 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Status</div>
                <div className="mt-2 text-sm font-medium text-foreground">{project.status}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-white/75 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Database</div>
                <div className="mt-2 text-sm font-medium text-foreground">{project.databaseName}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-white/75 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">API keys</div>
                <div className="mt-2 text-sm font-medium text-foreground">{project.apiKeyCount}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-white/75 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Active prefix</div>
                <div className="mt-2 text-sm font-medium text-foreground">{project.activeApiKeyPrefix ?? '—'}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {!hasKeys ? (
                <Button className="bg-primary text-primary-foreground" onClick={onGenerateFirstApiKey}>
                  Generate first API key
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button variant="secondary" onClick={onOpenApiKeys}>
                  <KeyRound className="h-4 w-4" />
                  Manage API keys
                </Button>
              )}
              <Button variant="secondary" onClick={onOpenExplorer}>
                Open data explorer
              </Button>
              <Button variant="secondary" onClick={onOpenDocs}>
                <BookOpen className="h-4 w-4" />
                View docs
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-emerald-50/60">
          <CardHeader>
            <CardTitle className="text-base">Next step</CardTitle>
            <CardDescription>Use the sidebar to move between explorer, keys and docs.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            The project shell keeps the same layout across cluster and project views so the product can evolve phase by phase.
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
