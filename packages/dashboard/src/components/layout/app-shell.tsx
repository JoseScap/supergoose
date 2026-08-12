import type * as React from 'react';
import { ArrowLeft, ChevronRight, Database, Layers3, PanelLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ClusterModel } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BrandMark } from '@/components/brand-mark';
import { cn } from '@/lib/utils';

interface SidebarLink {
  label: string;
  href: string;
}

interface AppShellProps {
  cluster: ClusterModel;
  mode: 'root' | 'cluster' | 'project';
  pathname: string;
  projectSlug?: string;
  children: React.ReactNode;
}

function ShellLink({
  label,
  href,
  active
}: SidebarLink & { active?: boolean }): React.JSX.Element {
  return (
    <Link
      to={href}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left text-sm transition-all duration-200',
        active
          ? 'border-primary/30 bg-emerald-100/60 text-foreground'
          : 'border-transparent text-muted-foreground hover:border-border/70 hover:bg-white/75 hover:text-foreground'
      )}
    >
      <span className="text-primary">
        <ChevronRight className="h-4 w-4" />
      </span>
      <span className="flex-1">{label}</span>
    </Link>
  );
}

export function AppShell({ cluster, mode, pathname, projectSlug, children }: AppShellProps): React.JSX.Element {
  const workspaceLabel =
    mode === 'project' ? 'Project workspace' : mode === 'cluster' ? 'Cluster workspace' : 'Starting screen';
  const workspaceDescription =
    mode === 'project' ? 'Readonly data explorer, API keys and documentation.' : mode === 'cluster' ? 'Project listing and cluster overview.' : 'Empty dashboard shell.';
  const currentLabel = pathname === '/' ? 'Home' : pathname.replace(/^\/+/, '').replaceAll('/', ' / ');

  const links: SidebarLink[] =
    mode === 'project'
      ? [
          { label: 'Overview', href: `/projects/${projectSlug ?? ''}` },
          { label: 'Data Explorer', href: `/projects/${projectSlug ?? ''}/data-explorer` },
          { label: 'API Keys', href: `/projects/${projectSlug ?? ''}/api-keys` },
          { label: 'Documentation', href: `/projects/${projectSlug ?? ''}/documentation` }
        ]
      : [{ label: 'Projects', href: '/projects' }];

  const isProjectRoute = pathname.startsWith('/projects/');

  return (
    <div className="min-h-dvh bg-[color:var(--background)] text-foreground">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_24%),radial-gradient(circle_at_top_left,rgba(16,185,129,0.05),transparent_22%)]" />

      <div className="mx-auto grid min-h-dvh max-w-[1800px] gap-0 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-b border-border/70 bg-emerald-50/55 px-4 py-4 backdrop-blur-xl lg:min-h-dvh lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col gap-5 lg:sticky lg:top-0 lg:h-dvh lg:py-2">
            <div className="flex items-start justify-between gap-3">
              <BrandMark />
              <Button variant="ghost" size="icon" className="text-muted-foreground lg:hidden" aria-label="Open navigation">
                <PanelLeft className="h-4 w-4" />
              </Button>
            </div>

            {mode === 'project' ? (
              <Button asChild variant="secondary" className="justify-start gap-2">
                <Link to="/projects">
                  <ArrowLeft className="h-4 w-4" />
                  Back to cluster
                </Link>
              </Button>
            ) : null}

            <div className="rounded-3xl border border-border/70 bg-emerald-100/40 p-4">
              <div className="text-sm text-muted-foreground">{cluster.name}</div>
              <div className="mt-1 text-base font-semibold text-foreground">
                {mode === 'project' ? 'Project workspace' : mode === 'cluster' ? 'Cluster workspace' : 'Empty dashboard'}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {mode === 'project' ? 'Readonly data explorer' : mode === 'cluster' ? 'Project listing only' : 'Starting screen'}
              </div>
            </div>

            <div className="space-y-2">
              {links.map((link) => (
                <ShellLink
                  key={link.label}
                  {...link}
                active={
                  pathname === link.href ||
                  (pathname === '/projects' && link.href === '/projects') ||
                  (isProjectRoute && pathname.startsWith(link.href))
                }
              />
            ))}
            </div>
          </div>
        </aside>

        <main className="min-w-0 p-4 lg:p-6 xl:p-8">
          <div className="space-y-6">
            <Card className="border-primary/15 bg-emerald-50/60">
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    <span>{cluster.name}</span>
                    <span className="text-primary">/</span>
                    <span>{mode}</span>
                  </div>
                  <div className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    {mode === 'project' ? <Database className="h-5 w-5 text-primary" /> : <Layers3 className="h-5 w-5 text-primary" />}
                    <span>{workspaceLabel}</span>
                  </div>
                  <p className="max-w-2xl text-sm text-muted-foreground">{workspaceDescription}</p>
                </div>

                <div className="rounded-2xl border border-border/70 bg-white/75 px-4 py-3 text-sm text-muted-foreground">
                  <div className="text-xs uppercase tracking-[0.2em]">Current route</div>
                  <div className="mt-1 font-medium text-foreground">{currentLabel}</div>
                </div>
              </CardContent>
            </Card>

            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
