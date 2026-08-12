import type * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, Table2 } from 'lucide-react';
import type { ProjectModel, CollectionModel, DataDocument } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn, formatDateTime, formatNumber } from '@/lib/utils';

interface DataExplorerProps {
  project: ProjectModel;
}

function documentPreviewValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return '-';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function getFields(documents: DataDocument[]): string[] {
  const fields = new Set<string>();

  for (const document of documents.slice(0, 8)) {
    for (const key of Object.keys(document)) {
      if (key !== '_id') {
        fields.add(key);
      }
    }
  }

  return [...fields].slice(0, 4);
}

function getSortableFields(documents: DataDocument[]): string[] {
  const fields = new Set<string>(['_id']);

  for (const document of documents.slice(0, 25)) {
    for (const key of Object.keys(document)) {
      fields.add(key);
    }
  }

  return [...fields];
}

function normalizeComparableValue(value: unknown): string | number {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  if (typeof value === 'string') {
    const dateValue = Date.parse(value);
    if (!Number.isNaN(dateValue) && /T\d{2}:\d{2}:\d{2}/.test(value)) {
      return dateValue;
    }

    const numericValue = Number(value);
    if (!Number.isNaN(numericValue) && value.trim() !== '') {
      return numericValue;
    }

    return value.toLowerCase();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  return JSON.stringify(value);
}

function compareValues(left: unknown, right: unknown): number {
  const normalizedLeft = normalizeComparableValue(left);
  const normalizedRight = normalizeComparableValue(right);

  if (typeof normalizedLeft === 'number' && typeof normalizedRight === 'number') {
    return normalizedLeft - normalizedRight;
  }

  return String(normalizedLeft).localeCompare(String(normalizedRight));
}

export function DataExplorer({ project }: DataExplorerProps): React.JSX.Element {
  const [collectionName, setCollectionName] = useState(project.collections[0]?.name ?? '');
  const [query, setQuery] = useState('');
  const [sortField, setSortField] = useState('_id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setCollectionName(project.collections[0]?.name ?? '');
    setQuery('');
    setSortField('_id');
    setSortDirection('asc');
    setPageSize(10);
    setPage(1);
    setSelectedIndex(0);
  }, [project.id]);

  const collection = useMemo<CollectionModel | undefined>(
    () => project.collections.find((entry) => entry.name === collectionName) ?? project.collections[0],
    [project.collections, collectionName]
  );

  const filteredDocuments = useMemo(() => {
    const documents = collection?.documents ?? [];
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return documents;
    }

    return documents.filter((document) => JSON.stringify(document).toLowerCase().includes(normalizedQuery));
  }, [collection, query]);

  useEffect(() => {
    setPage(1);
    setSelectedIndex(0);
  }, [collectionName, query, sortField, sortDirection, pageSize, project.id]);

  const sortableFields = useMemo(() => getSortableFields(filteredDocuments), [filteredDocuments]);

  useEffect(() => {
    if (!sortableFields.includes(sortField)) {
      setSortField('_id');
    }
  }, [sortField, sortableFields]);

  const sortedDocuments = useMemo(() => {
    const documents = [...filteredDocuments];
    const direction = sortDirection === 'asc' ? 1 : -1;

    documents.sort((left, right) => direction * compareValues(left[sortField], right[sortField]));

    return documents;
  }, [filteredDocuments, sortDirection, sortField]);

  const totalPages = Math.max(1, Math.ceil(sortedDocuments.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pageDocuments = sortedDocuments.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    if (selectedIndex >= pageDocuments.length) {
      setSelectedIndex(0);
    }
  }, [pageDocuments.length, selectedIndex]);

  const selectedDocument = pageDocuments[selectedIndex] ?? pageDocuments[0];
  const fields = getFields(sortedDocuments);

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
      <Card id="collections" className="xl:sticky xl:top-6 xl:h-[calc(100dvh-3rem)] xl:overflow-auto">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Collections</CardTitle>
          <CardDescription>Choose the collection you want to inspect.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {project.collections.map((collectionItem) => {
            const active = collectionItem.name === collection?.name;

            return (
              <button
                key={collectionItem.name}
                type="button"
                onClick={() => setCollectionName(collectionItem.name)}
                className={cn(
                  'w-full rounded-2xl border px-4 py-3 text-left transition-all duration-200',
                  active ? 'border-primary/30 bg-emerald-100/60 text-foreground shadow-[0_18px_40px_-26px_rgba(15,23,42,0.2)]' : 'border-border/70 bg-white/75 text-muted-foreground hover:bg-emerald-50/60 hover:text-foreground'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{collectionItem.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{collectionItem.documents.length} documents</div>
                  </div>
                  <Badge variant={active ? 'success' : 'muted'}>{collectionItem.indexes} docs</Badge>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">Updated {formatDateTime(collectionItem.updatedAt)}</div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card id="explorer" className="min-w-0">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">{collection?.name ?? 'No collection selected'}</CardTitle>
              <CardDescription>
                {collection ? `${formatNumber(collection.documents.length)} documents in this collection.` : 'Select a collection to continue.'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="muted">Readonly</Badge>
              <Badge variant="muted">Mongo-like explorer</Badge>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_160px_140px]">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents, fields, values..." />
            <label className="grid gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Sort field
              <select
                value={sortField}
                onChange={(event) => setSortField(event.target.value)}
                className="h-10 rounded-2xl border border-border/70 bg-white/80 px-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              >
                {sortableFields.map((field) => (
                  <option key={field} value={field}>
                    {field}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Direction
              <select
                value={sortDirection}
                onChange={(event) => setSortDirection(event.target.value === 'desc' ? 'desc' : 'asc')}
                className="h-10 rounded-2xl border border-border/70 bg-white/80 px-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </label>
            <label className="grid gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Page size
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="h-10 rounded-2xl border border-border/70 bg-white/80 px-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              >
                {[5, 10, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {collection ? (
            <>
              <div className="overflow-hidden rounded-3xl border border-border/70 bg-emerald-50/60">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border/70 text-left text-sm">
                    <thead className="bg-emerald-100/45 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Id</th>
                        {fields.map((field) => (
                          <th key={field} className="px-4 py-3">
                            {field}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70 bg-emerald-50/50">
                      {pageDocuments.map((document, index) => (
                        <tr
                          key={document._id}
                          onClick={() => setSelectedIndex(index)}
                          className={cn(
                            'cursor-pointer transition-colors duration-150 hover:bg-white/70',
                            index === selectedIndex && 'bg-emerald-100/60'
                          )}
                        >
                          <td className="max-w-[220px] px-4 py-3 font-mono text-xs text-primary">{document._id}</td>
                          {fields.map((field) => (
                            <td key={field} className="px-4 py-3 text-foreground">
                              {documentPreviewValue(document[field])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {pageDocuments.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border/70 bg-emerald-50/70 px-6 py-12 text-center text-sm text-muted-foreground">
                  No documents match the current search.
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/70 bg-white/75 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ArrowUpDown className="h-4 w-4 text-primary" />
                  <span>
                    Showing {startIndex + 1}-{startIndex + pageDocuments.length} of {sortedDocuments.length}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="secondary" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                    Previous
                  </Button>
                  <span className="min-w-20 rounded-2xl border border-border/70 bg-emerald-50 px-3 py-2 text-center text-sm text-foreground">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-border/70 bg-emerald-50/70 px-6 py-12 text-center text-sm text-muted-foreground">
              No collection selected.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="xl:sticky xl:top-6 xl:h-[calc(100dvh-3rem)] xl:overflow-auto">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Document detail</CardTitle>
          <CardDescription>Preview the selected document and its fields.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedDocument ? (
            <>
              <div className="rounded-3xl border border-border/70 bg-white/75 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Selected id</div>
                <div className="mt-2 break-all font-mono text-xs text-primary">{selectedDocument._id}</div>
              </div>

              <div className="space-y-3">
                {Object.entries(selectedDocument)
                  .filter(([key]) => key !== '_id')
                  .map(([key, value]) => (
                    <div key={key} className="rounded-2xl border border-border/70 bg-white/75 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{key}</div>
                      <div className="mt-1 text-sm text-foreground">{documentPreviewValue(value)}</div>
                    </div>
                  ))}
              </div>

              <div className="rounded-3xl border border-border/70 bg-white/75 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Table2 className="h-4 w-4 text-primary" />
                  Raw JSON
                </div>
                <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-foreground">
                  {JSON.stringify(selectedDocument, null, 2)}
                </pre>
              </div>
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-border/70 bg-emerald-50/70 px-6 py-12 text-center text-sm text-muted-foreground">
              Select a document to inspect its fields.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
