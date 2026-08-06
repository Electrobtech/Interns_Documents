'use client';
/** Knowledge Base — what the Marketing Agent is allowed to cite.
 *  Uploads are async (202 + worker); the hook polls while indexing runs. */
import { useRef } from 'react';
import { BookOpen, Upload, Trash2, Loader2 } from 'lucide-react';
import { useKnowledgeSources, useUploadKnowledge, useDeleteKnowledge } from '@/lib/queries/aiAgents';
import { Card, SectionTitle, Badge, Button, DataTable, EmptyState } from '../MarketingUI';
import { PageHeader, Toolbar, ToolButton, ToolSearch } from '../HubUI';

const STATUS_TONE = { ready: 'green', processing: 'amber', pending: 'amber', failed: 'red' };

export default function KnowledgeBase() {
  const fileRef = useRef(null);
  const { data: sources, isLoading } = useKnowledgeSources('marketing');
  const upload = useUploadKnowledge('marketing');
  const del = useDeleteKnowledge('marketing');

  return (
    <div className="space-y-4">
      <PageHeader
        title="Knowledge Base"
        subtitle="Sources the Marketing Agent retrieves from. A source stays cited in past traces even after deletion."
      />

      <Toolbar
        right={<span className="text-[11px] text-slate-400">Sources are soft-deleted so past traces stay readable</span>}
      >
        <span className="text-[12px] text-slate-500 px-1">
          Marketing-scoped documents the agent retrieves from
        </span>
      </Toolbar>

      <Card className="p-5">
      <SectionTitle
        title="Documents"
        subtitle="Everything the Marketing Agent can cite \u2014 and nothing else"
        action={
          <>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.docx,.xlsx,.csv,.txt,.md,.html"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload.mutate(f);
                e.target.value = '';
              }}
            />
            <Button
              variant="primary"
              icon={upload.isPending ? Loader2 : Upload}
              onClick={() => fileRef.current?.click()}
              disabled={upload.isPending}
            >
              {upload.isPending ? 'Uploading\u2026' : 'Upload'}
            </Button>
          </>
        }
      />
      <DataTable
        columns={[
          { key: 'name', label: 'Document', render: (r) => <span className="font-medium">{r.name}</span> },
          { key: 'source_type', label: 'Type', render: (r) => <Badge>{r.source_type}</Badge> },
          {
            key: 'status',
            label: 'Status',
            render: (r) => (
              <Badge tone={STATUS_TONE[r.status] || 'slate'}>
                {r.status === 'processing' ? 'indexing\u2026' : r.status}
              </Badge>
            ),
          },
          { key: 'chunk_count', label: 'Chunks' },
          { key: 'version', label: 'Ver', render: (r) => `v${r.version}` },
          {
            key: 'actions',
            label: '',
            render: (r) => (
              <button
                onClick={() => del.mutate(r.id)}
                className="text-slate-300 hover:text-red-500 transition-colors"
                title="Remove"
              >
                <Trash2 size={14} />
              </button>
            ),
          },
        ]}
        rows={sources || []}
        empty={
          <EmptyState
            icon={BookOpen}
            title={isLoading ? 'Loading\u2026' : 'No documents yet'}
            body="Without documents the agent answers ungrounded and says so, at low confidence. Upload pricing, positioning or product material to fix that."
          />
        }
      />
      </Card>
    </div>
  );
}
