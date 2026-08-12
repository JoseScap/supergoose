import type * as React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClusterDashboard } from '@/components/cluster-dashboard';
import { createDashboardProject, listDashboardProjects, type DashboardProjectSummary } from '@/lib/dashboard-api';
import { Card, CardContent } from '@/components/ui/card';

export function ProjectsPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<DashboardProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadProjects(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      setProjects(await listDashboardProjects());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  if (loading) {
    return <Card className="bg-emerald-50/60"><CardContent className="p-6 text-sm text-muted-foreground">Loading projects...</CardContent></Card>;
  }

  if (error) {
    return <Card className="border-red-200 bg-red-50/80"><CardContent className="p-6 text-sm text-red-700">{error}</CardContent></Card>;
  }

  return (
    <ClusterDashboard
      projects={projects}
      onOpenProject={(slug) => {
        navigate(`/projects/${slug}`);
      }}
      onCreateProject={async (input) => {
        await createDashboardProject(input);
        await loadProjects();
      }}
    />
  );
}
