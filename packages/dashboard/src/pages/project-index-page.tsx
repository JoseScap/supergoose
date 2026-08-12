import type * as React from 'react';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ProjectDashboard } from '@/components/project-dashboard';
import { Card, CardContent } from '@/components/ui/card';
import {
  createDashboardApiKey,
  getDashboardProject,
  type DashboardProjectSummary
} from '@/lib/dashboard-api';

export function ProjectIndexPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { slug } = useParams();
  const projectSlug = slug ?? '';
  const [project, setProject] = useState<DashboardProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadProject(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      setProject(await getDashboardProject(projectSlug));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProject();
  }, [projectSlug]);

  if (!projectSlug) {
    return <Navigate to="/projects" replace />;
  }

  if (loading) {
    return <Card className="bg-emerald-50/60"><CardContent className="p-6 text-sm text-muted-foreground">Loading project...</CardContent></Card>;
  }

  if (error) {
    return <Card className="border-red-200 bg-red-50/80"><CardContent className="p-6 text-sm text-red-700">{error}</CardContent></Card>;
  }

  if (!project) {
    return <Navigate to="/projects" replace />;
  }

  return (
    <ProjectDashboard
      project={project}
      onOpenExplorer={() => {
        navigate(`/projects/${project.slug}/data-explorer`);
      }}
      onOpenApiKeys={() => {
        navigate(`/projects/${project.slug}/api-keys`);
      }}
      onOpenDocs={() => {
        navigate(`/projects/${project.slug}/documentation`);
      }}
      onGenerateFirstApiKey={async () => {
        await createDashboardApiKey(project.slug, {});
        await loadProject();
      }}
    />
  );
}
