import type * as React from 'react';
import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  createDashboardApiKey,
  getDashboardProject,
  listDashboardApiKeys,
  revokeDashboardApiKey,
  rotateDashboardApiKey,
  type DashboardApiKey,
  type DashboardProjectSummary
} from '@/lib/dashboard-api';

export function ProjectApiKeysPage(): React.JSX.Element {
  const { slug } = useParams();
  const projectSlug = slug ?? '';
  const [project, setProject] = useState<DashboardProjectSummary | null>(null);
  const [apiKeys, setApiKeys] = useState<DashboardApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latestSecret, setLatestSecret] = useState<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const [projectResult, apiKeysResult] = await Promise.all([
        getDashboardProject(projectSlug),
        listDashboardApiKeys(projectSlug)
      ]);

      setProject(projectResult);
      setApiKeys(apiKeysResult);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [projectSlug]);

  if (!projectSlug) {
    return <Navigate to="/projects" replace />;
  }

  if (loading) {
    return <Card className="bg-emerald-50/60"><CardContent className="p-6 text-sm text-muted-foreground">Loading API keys...</CardContent></Card>;
  }

  if (error) {
    return <Card className="border-red-200 bg-red-50/80"><CardContent className="p-6 text-sm text-red-700">{error}</CardContent></Card>;
  }

  if (!project) {
    return <Navigate to="/projects" replace />;
  }

  const activeKeys = apiKeys.filter((key) => !key.revokedAt);

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">API Keys</h1>
        <p className="text-sm text-muted-foreground">
          The first key is created manually from here. After that, only rotation and revocation are available.
        </p>
      </div>

      {latestSecret ? (
        <Card className="border-primary/20 bg-emerald-50/80">
          <CardHeader>
            <CardTitle className="text-base">Secret shown once</CardTitle>
            <CardDescription>Copy it now. It will not be shown again after you leave this view.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <pre className="overflow-auto rounded-2xl border border-border/70 bg-white/80 p-4 text-xs leading-6 text-foreground">{latestSecret}</pre>
            <Button
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(latestSecret);
              }}
            >
              Copy secret
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="bg-emerald-50/80">
        <CardHeader>
          <CardTitle className="text-base">{activeKeys.length === 0 ? 'Generate first API key' : 'Rotate API key'}</CardTitle>
          <CardDescription>
            {activeKeys.length === 0 ? 'No active key exists yet for this project.' : 'A new key will replace the active one and revoke the previous secret.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {activeKeys.length === 0 ? (
            <Button
              className="bg-primary text-primary-foreground"
              onClick={async () => {
                const result = await createDashboardApiKey(project.slug, {});
                setLatestSecret(result.apiKey.key);
                await load();
              }}
            >
              Generate first API key
            </Button>
          ) : (
            <Button
              className="bg-primary text-primary-foreground"
              onClick={async () => {
                const result = await rotateDashboardApiKey(project.slug, {});
                setLatestSecret(result.apiKey.key);
                await load();
              }}
            >
              Rotate API key
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {apiKeys.map((apiKey) => (
          <Card key={apiKey.id} className="bg-white/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="font-mono text-sm text-foreground">{apiKey.keyPrefix}</span>
                {apiKey.revokedAt ? <Badge variant="muted">Revoked</Badge> : <Badge variant="success">Active</Badge>}
              </CardTitle>
              <CardDescription>{apiKey.scopes.join(', ')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span>Created {new Date(apiKey.createdAt).toLocaleString()}</span>
              {apiKey.lastUsedAt ? <span>Last used {new Date(apiKey.lastUsedAt).toLocaleString()}</span> : null}
              {!apiKey.revokedAt ? (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await revokeDashboardApiKey(project.slug, apiKey.id);
                    await load();
                  }}
                >
                  Revoke key
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
