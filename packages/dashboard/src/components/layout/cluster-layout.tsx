import type * as React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppShell } from './app-shell';
import { clusterModel } from '@/data/mock';

interface ClusterLayoutProps {
  variant: 'root' | 'cluster';
}

export function ClusterLayout({ variant }: ClusterLayoutProps): React.JSX.Element {
  const location = useLocation();

  return (
    <AppShell cluster={clusterModel} mode={variant} pathname={location.pathname}>
      <Outlet />
    </AppShell>
  );
}
