import type * as React from 'react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatNumber } from '@/lib/utils';
import type { DashboardProjectSummary } from '@/lib/dashboard-api';

interface ClusterDashboardProps {
  projects: DashboardProjectSummary[];
  onOpenProject: (slug: string) => void;
  onCreateProject: (input: { name: string; slug: string }) => Promise<void> | void;
}

export function ClusterDashboard({ projects, onOpenProject, onCreateProject }: ClusterDashboardProps): React.JSX.Element {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Projects</h1>
        <p className="text-sm text-muted-foreground">Create and open projects from the cluster dashboard.</p>
      </div>

      <Card className="border-primary/15 bg-emerald-50/70">
        <CardHeader>
          <CardTitle className="text-base">Create project</CardTitle>
          <CardDescription>Only metadata is created here. API keys are generated from inside the project.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Project name" />
          <Input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="project-slug" />
          <Button
            className="bg-primary text-primary-foreground"
            disabled={isSubmitting || !name.trim() || !slug.trim()}
            onClick={async () => {
              setIsSubmitting(true);
              try {
                await onCreateProject({ name: name.trim(), slug: slug.trim() });
                setName('');
                setSlug('');
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            Create project
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Badge variant="muted">{formatNumber(projects.length)} projects</Badge>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {projects.map((project) => (
          <Card key={project.id} className="bg-emerald-50/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">{project.name}</CardTitle>
              <CardDescription>{project.slug}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium text-foreground">{project.status}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Database</span>
                <span className="font-medium text-foreground">{project.databaseName}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">API keys</span>
                <span className="font-medium text-foreground">{project.apiKeyCount}</span>
              </div>

              <Button variant="secondary" className="w-full justify-between" onClick={() => onOpenProject(project.slug)}>
                Open project
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
