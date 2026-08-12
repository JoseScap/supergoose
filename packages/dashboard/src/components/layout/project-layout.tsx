import type * as React from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { AppShell } from './app-shell';
import { clusterModel } from '@/data/mock';

export interface ProjectLayoutContext {
  projectSlug: string;
}

export function ProjectLayout(): React.JSX.Element {
  const location = useLocation();
  const { slug } = useParams();
  const projectSlug = slug ?? '';

  return (
    <AppShell cluster={clusterModel} mode="project" pathname={location.pathname} projectSlug={projectSlug}>
      <Outlet context={{ projectSlug } satisfies ProjectLayoutContext} />
    </AppShell>
  );
}
