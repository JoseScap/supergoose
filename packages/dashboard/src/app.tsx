import type * as React from 'react';
import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ClusterLayout } from '@/components/layout/cluster-layout';
import { ProjectLayout } from '@/components/layout/project-layout';
import { RootPage } from '@/pages/root-page';
import { ProjectsPage } from '@/pages/projects-page';
import { ProjectIndexPage } from '@/pages/project-index-page';
import { ProjectExplorerPage } from '@/pages/project-explorer-page';
import { ProjectApiKeysPage } from '@/pages/project-api-keys-page';
import { ProjectDocumentationPage } from '@/pages/project-documentation-page';
import { getDashboardMe, loginDashboard, type DashboardRootUser } from '@/lib/dashboard-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function DashboardGate({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [authenticatedUser, setAuthenticatedUser] = useState<DashboardRootUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function promptForCredentials(attempt = 0): Promise<boolean> {
    const username = window.prompt('Root username');

    if (!username) {
      return false;
    }

    const password = window.prompt('Root password');

    if (!password) {
      return false;
    }

    try {
      const rootUser = await loginDashboard(username, password);
      setAuthenticatedUser(rootUser);
      return true;
    } catch (loginError) {
      if (attempt < 2) {
        window.alert('Invalid credentials. Please try again.');
        return promptForCredentials(attempt + 1);
      }

      setError(loginError instanceof Error ? loginError.message : 'Unable to authenticate');
      return false;
    }
  }

  useEffect(() => {
    let active = true;

    async function bootstrap(): Promise<void> {
      try {
        const rootUser = await getDashboardMe();

        if (!active) {
          return;
        }

        setAuthenticatedUser(rootUser);
        setError(null);
      } catch (bootstrapError) {
        const status = bootstrapError instanceof Error ? (bootstrapError as Error & { status?: number }).status : undefined;

        if (status !== 401) {
          if (active) {
            setError(bootstrapError instanceof Error ? bootstrapError.message : 'Unable to load session');
          }
          return;
        }

        if (!active) {
          return;
        }

        const authenticated = await promptForCredentials();

        if (!active) {
          return;
        }

        if (!authenticated) {
          setError('Authentication is required to use the dashboard.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[color:var(--background)] px-4">
        <Card className="w-full max-w-md bg-emerald-50/80">
          <CardHeader>
            <CardTitle className="text-base">Preparing dashboard</CardTitle>
            <CardDescription>Checking root session...</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Please wait.</CardContent>
        </Card>
      </div>
    );
  }

  if (error && !authenticatedUser) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[color:var(--background)] px-4">
        <Card className="w-full max-w-md border-red-200 bg-red-50/80">
          <CardHeader>
            <CardTitle className="text-base">Dashboard access required</CardTitle>
            <CardDescription>Use a root user to enter the dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-red-700">
            <p>{error}</p>
            <Button
              className="bg-primary text-primary-foreground"
              onClick={async () => {
                setError(null);
                setLoading(true);
                const authenticated = await promptForCredentials();
                if (!authenticated) {
                  setError('Authentication is required to use the dashboard.');
                }
                setLoading(false);
              }}
            >
              Retry login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

export function App(): React.JSX.Element {
  return (
    <DashboardGate>
      <Routes>
        <Route element={<ClusterLayout variant="root" />}>
          <Route index element={<RootPage />} />
        </Route>

        <Route path="/projects" element={<ClusterLayout variant="cluster" />}>
          <Route index element={<ProjectsPage />} />
        </Route>

        <Route path="/projects/:slug" element={<ProjectLayout />}>
          <Route index element={<ProjectIndexPage />} />
          <Route path="data-explorer" element={<ProjectExplorerPage />} />
          <Route path="api-keys" element={<ProjectApiKeysPage />} />
          <Route path="documentation" element={<ProjectDocumentationPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DashboardGate>
  );
}
