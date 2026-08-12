import type * as React from 'react';
import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { DataExplorer } from '@/components/data-explorer';
import { Card, CardContent } from '@/components/ui/card';
import { getDashboardExplorer, type DashboardExplorerResponse } from '@/lib/dashboard-api';
import type { ProjectModel } from '@/types';

export function ProjectExplorerPage(): React.JSX.Element {
  const { slug } = useParams();
  const projectSlug = slug ?? '';
  const [explorer, setExplorer] = useState<DashboardExplorerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadExplorer(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      setExplorer(await getDashboardExplorer(projectSlug));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load explorer');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadExplorer();
  }, [projectSlug]);

  if (!projectSlug) {
    return <Navigate to="/projects" replace />;
  }

  if (loading) {
    return <Card className="bg-emerald-50/60"><CardContent className="p-6 text-sm text-muted-foreground">Loading explorer...</CardContent></Card>;
  }

  if (error) {
    return <Card className="border-red-200 bg-red-50/80"><CardContent className="p-6 text-sm text-red-700">{error}</CardContent></Card>;
  }

  if (!explorer) {
    return <Navigate to="/projects" replace />;
  }

  const project: ProjectModel = {
    id: explorer.project.id,
    name: explorer.project.name,
    slug: explorer.project.slug,
    status: explorer.project.status === 'active' ? 'active' : 'maintenance',
    description: `Explorer for ${explorer.project.databaseName}`,
    databaseName: explorer.project.databaseName,
    lastSync: explorer.project.updatedAt,
    apiKeyPrefix: explorer.project.activeApiKeyPrefix ?? '',
    collections: explorer.collections.map((collection) => ({
      name: collection.name,
      indexes: collection.indexes,
      updatedAt: collection.updatedAt,
      documents: collection.documents
    }))
  };

  return <DataExplorer project={project} />;
}
