import type * as React from 'react';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type ExampleKey = 'curl' | 'fetch-js' | 'fetch-ts' | 'axios-js' | 'axios-ts';
type OperationKey = 'get-list' | 'get-id' | 'post' | 'patch' | 'delete';
type LanguageKey = 'shell' | 'javascript' | 'typescript';

interface CodeExample {
  label: string;
  language: LanguageKey;
  code: string;
}

interface OperationExample {
  title: string;
  description: string;
}

function CodeBlock({
  language,
  code
}: {
  language: LanguageKey;
  code: string;
}): React.JSX.Element {
  const lines = code.split('\n');

  return (
    <pre className="overflow-auto rounded-3xl border border-slate-700/70 bg-[#1e1e1e] p-4 text-xs leading-6 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.7)]">
      <code className="font-mono">
        {lines.map((line, index) => (
          <div key={`${language}-${index}`}>{highlightLine(line, language)}</div>
        ))}
      </code>
    </pre>
  );
}

function highlightLine(line: string, language: LanguageKey): React.ReactNode {
  if (!line) {
    return <span className="text-slate-100">&nbsp;</span>;
  }

  return language === 'shell' ? highlightShellLine(line) : highlightScriptLine(line);
}

function highlightShellLine(line: string): React.ReactNode {
  const parts = line.split(/(\s+|".*?"|'.*?'|--?[a-z-]+|https?:\/\/[^\s]+)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (/^--?[a-z-]+$/.test(part)) {
      return (
        <span key={index} className="text-cyan-300">
          {part}
        </span>
      );
    }

    if (/^".*"$/.test(part) || /^'.*'$/.test(part)) {
      return (
        <span key={index} className="text-amber-300">
          {part}
        </span>
      );
    }

    if (/^https?:\/\//.test(part) || part.includes('/api/')) {
      return (
        <span key={index} className="text-emerald-300">
          {part}
        </span>
      );
    }

    return (
      <span key={index} className="text-slate-100">
        {part}
      </span>
    );
  });
}

function highlightScriptLine(line: string): React.ReactNode {
  const tokens: Array<{ text: string; className: string }> = [];
  const pattern = /(`[^`]*`|'[^']*'|"[^"]*"|\b(const|let|var|await|async|return|import|from|type|interface|extends|new|class|function|as|Record|Promise|unknown|Array|string|number|boolean)\b|\b\d+(\.\d+)?\b|\b(fetch|axios|Authorization|headers|body|method|response|data|get|post|patch|delete)\b)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        text: line.slice(lastIndex, match.index),
        className: 'text-slate-100'
      });
    }

    const token = match[0];
    let className = 'text-slate-100';

    if (/^`[^`]*`$|^'[^']*'$|^"[^"]*"$/.test(token)) {
      className = 'text-amber-300';
    } else if (/^\b(const|let|var|await|async|return|import|from|type|interface|extends|new|class|function|as|Record|Promise|unknown|Array|string|number|boolean)\b$/.test(token)) {
      className = 'text-sky-300';
    } else if (/^\b\d+(\.\d+)?\b$/.test(token)) {
      className = 'text-emerald-300';
    } else {
      className = 'text-violet-300';
    }

    tokens.push({ text: token, className });
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < line.length) {
    tokens.push({ text: line.slice(lastIndex), className: 'text-slate-100' });
  }

  return tokens.map((token, index) => (
    <span key={index} className={token.className}>
      {token.text}
    </span>
  ));
}

function codeFor(variant: ExampleKey, operation: OperationKey): CodeExample {
  const baseUrl = 'http://localhost:3000';
  const apiKey = '<API_KEY>';
  const project = '<PROJECT>';
  const collection = '<COLLECTION>';
  const documentId = '<DOCUMENT_ID>';
  const listEndpoint = `${baseUrl}/api/${project}/${collection}`;
  const itemEndpoint = `${listEndpoint}/${documentId}`;

  const shellExamples: Record<OperationKey, string> = {
    'get-list': `curl -s -H "Authorization: Bearer ${apiKey}" \\
  ${listEndpoint}`,
    'get-id': `curl -s -H "Authorization: Bearer ${apiKey}" \\
  ${itemEndpoint}`,
    post: `curl -s -X POST ${listEndpoint} \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "content-type: application/json" \\
  -d '{
    "name": "Jacket",
    "price": 199.99,
    "status": "draft"
  }'`,
    patch: `curl -s -X PATCH ${itemEndpoint} \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "content-type: application/json" \\
  -d '{
    "status": "published"
  }'`,
    delete: `curl -s -X DELETE ${itemEndpoint} \\
  -H "Authorization: Bearer ${apiKey}"`
  };

  const fetchJsExamples: Record<OperationKey, string> = {
    'get-list': `fetch('${listEndpoint}', {
  headers: {
    Authorization: 'Bearer ${apiKey}'
  }
}).then((response) => response.json());`,
    'get-id': `fetch('${itemEndpoint}', {
  headers: {
    Authorization: 'Bearer ${apiKey}'
  }
}).then((response) => response.json());`,
    post: `fetch('${listEndpoint}', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer ${apiKey}',
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Jacket',
    price: 199.99,
    status: 'draft'
  })
});`,
    patch: `fetch('${itemEndpoint}', {
  method: 'PATCH',
  headers: {
    Authorization: 'Bearer ${apiKey}',
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    status: 'published'
  })
});`,
    delete: `fetch('${itemEndpoint}', {
  method: 'DELETE',
  headers: {
    Authorization: 'Bearer ${apiKey}'
  }
});`
  };

  const fetchTsExamples: Record<OperationKey, string> = {
    'get-list': `const response = await fetch('${listEndpoint}', {
  headers: {
    Authorization: 'Bearer ${apiKey}'
  }
});

const data = (await response.json()) as unknown;`,
    'get-id': `const response = await fetch('${itemEndpoint}', {
  headers: {
    Authorization: 'Bearer ${apiKey}'
  }
});

const data = (await response.json()) as unknown;`,
    post: `const response = await fetch('${listEndpoint}', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer ${apiKey}',
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Jacket',
    price: 199.99,
    status: 'draft'
  })
});

const data = (await response.json()) as unknown;`,
    patch: `const response = await fetch('${itemEndpoint}', {
  method: 'PATCH',
  headers: {
    Authorization: 'Bearer ${apiKey}',
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    status: 'published'
  })
});

const data = (await response.json()) as unknown;`,
    delete: `const response = await fetch('${itemEndpoint}', {
  method: 'DELETE',
  headers: {
    Authorization: 'Bearer ${apiKey}'
  }
});

const data = (await response.json()) as unknown;`
  };

  const axiosJsExamples: Record<OperationKey, string> = {
    'get-list': `import axios from 'axios';

axios.get('${listEndpoint}', {
  headers: {
    Authorization: 'Bearer ${apiKey}'
  }
});`,
    'get-id': `import axios from 'axios';

axios.get('${itemEndpoint}', {
  headers: {
    Authorization: 'Bearer ${apiKey}'
  }
});`,
    post: `import axios from 'axios';

axios.post('${listEndpoint}', {
  name: 'Jacket',
  price: 199.99,
  status: 'draft'
}, {
  headers: {
    Authorization: 'Bearer ${apiKey}'
  }
});`,
    patch: `import axios from 'axios';

axios.patch('${itemEndpoint}', {
  status: 'published'
}, {
  headers: {
    Authorization: 'Bearer ${apiKey}'
  }
});`,
    delete: `import axios from 'axios';

axios.delete('${itemEndpoint}', {
  headers: {
    Authorization: 'Bearer ${apiKey}'
  }
});`
  };

  const axiosTsExamples: Record<OperationKey, string> = {
    'get-list': `import axios from 'axios';

type Document = Record<string, unknown>;

const response = await axios.get<Document[]>('${listEndpoint}', {
  headers: {
    Authorization: 'Bearer ${apiKey}'
  }
});`,
    'get-id': `import axios from 'axios';

type Document = Record<string, unknown>;

const response = await axios.get<Document>('${itemEndpoint}', {
  headers: {
    Authorization: 'Bearer ${apiKey}'
  }
});`,
    post: `import axios from 'axios';

type Document = Record<string, unknown>;

const response = await axios.post<Document>('${listEndpoint}', {
  name: 'Jacket',
  price: 199.99,
  status: 'draft'
}, {
  headers: {
    Authorization: 'Bearer ${apiKey}'
  }
});`,
    patch: `import axios from 'axios';

type Document = Record<string, unknown>;

const response = await axios.patch<Document>('${itemEndpoint}', {
  status: 'published'
}, {
  headers: {
    Authorization: 'Bearer ${apiKey}'
  }
});`,
    delete: `import axios from 'axios';

const response = await axios.delete('${itemEndpoint}', {
  headers: {
    Authorization: 'Bearer ${apiKey}'
  }
});`
  };

  if (variant === 'curl') {
    return {
      label: 'curl',
      language: 'shell',
      code: shellExamples[operation]
    };
  }

  if (variant === 'fetch-js') {
    return {
      label: 'fetch - JavaScript',
      language: 'javascript',
      code: fetchJsExamples[operation]
    };
  }

  if (variant === 'fetch-ts') {
    return {
      label: 'fetch - TypeScript',
      language: 'typescript',
      code: fetchTsExamples[operation]
    };
  }

  if (variant === 'axios-js') {
    return {
      label: 'axios - JavaScript',
      language: 'javascript',
      code: axiosJsExamples[operation]
    };
  }

  return {
      label: 'axios - TypeScript',
      language: 'typescript',
      code: axiosTsExamples[operation]
  };
}

const operations: Array<[OperationKey, OperationExample]> = [
  ['get-list', { title: 'GET list', description: 'List documents in a collection.' }],
  ['get-id', { title: 'GET by id', description: 'Fetch a single document by its identifier.' }],
  ['post', { title: 'POST', description: 'Create a new document.' }],
  ['patch', { title: 'PATCH', description: 'Update an existing document.' }],
  ['delete', { title: 'DELETE', description: 'Delete a document.' }]
];

export function ProjectDocumentationPage(): React.JSX.Element {
  const [example, setExample] = useState<ExampleKey>('curl');

  const selectedLabel = useMemo(() => {
    switch (example) {
      case 'curl':
        return 'curl';
      case 'fetch-js':
        return 'fetch - JavaScript';
      case 'fetch-ts':
        return 'fetch - TypeScript';
      case 'axios-js':
        return 'axios - JavaScript';
      case 'axios-ts':
        return 'axios - TypeScript';
    }
  }, [example]);

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Documentation</h1>
        <p className="text-sm text-muted-foreground">
          Formato de consumo a la API. Elige la tecnología y mira un ejemplo por verbo.
        </p>
      </div>

      <Card className="bg-emerald-50/80">
        <CardHeader>
          <CardTitle className="text-base">Consume the generic API</CardTitle>
          <CardDescription>
            Cada bloque usa la misma ruta genérica y el header `Authorization: Bearer`.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2 sm:max-w-md">
            <label className="text-sm font-medium text-foreground" htmlFor="api-example-select">
              Technology
            </label>
            <select
              id="api-example-select"
              value={example}
              onChange={(event) => setExample(event.target.value as ExampleKey)}
              className="h-11 rounded-2xl border border-border/70 bg-white px-4 text-sm text-foreground outline-none transition-colors focus:border-primary"
            >
              <option value="curl">curl</option>
              <option value="fetch-js">fetch - JavaScript</option>
              <option value="fetch-ts">fetch - TypeScript</option>
              <option value="axios-js">axios - JavaScript</option>
              <option value="axios-ts">axios - TypeScript</option>
            </select>
          </div>

          <div className="grid gap-4">
            {operations.map(([operationKey, operation]) => {
              const selectedExample = codeFor(example, operationKey);

              return (
                <div key={operationKey} className="space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">{operation.title}</div>
                      <div className="text-xs text-muted-foreground">{operation.description}</div>
                    </div>
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{selectedLabel}</div>
                  </div>
                  <CodeBlock language={selectedExample.language} code={selectedExample.code} />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
