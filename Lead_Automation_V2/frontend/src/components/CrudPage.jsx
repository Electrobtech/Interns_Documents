'use client';
import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useApi } from '@/lib/useApi';
import DataTable from './DataTable';
import Modal from './Modal';
import ResourceForm from './ResourceForm';

// Generic list + create/edit/delete page driven by a resource config.
// { path, title, icon, columns, fields, readOnly?, idKey? }
export default function CrudPage({ path, title, icon: Icon, columns, fields, readOnly, idKey = 'id', header = true }) {
  const { call } = useApi();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [newKey, setNewKey] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    call(path)
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [call, path]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (row) => { setEditing(row); setModalOpen(true); };

  async function save(values) {
    setSubmitting(true);
    setError('');
    try {
      const id = editing?.[idKey];
      const res = id
        ? await call(`${path}/${id}`, { method: 'PUT', body: values })
        : await call(path, { method: 'POST', body: values });
      // Surface a one-time secret (e.g. a freshly minted API key).
      if (res && res.key) setNewKey(res.key);
      setModalOpen(false);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(row) {
    if (!confirm('Delete this record?')) return;
    try {
      await call(`${path}/${row[idKey]}`, { method: 'DELETE' });
      load();
    } catch (e) { setError(e.message); }
  }

  return (
    <div className={`${header ? 'p-6' : ''} space-y-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {header && Icon && <Icon size={20} className="text-brand" />}
          {header && <h2 className="text-lg font-bold">{title}</h2>}
        </div>
        {!readOnly && (
          <button onClick={openNew}
            className="flex items-center gap-1.5 bg-brand text-white text-sm rounded-lg px-3 py-2 font-medium">
            <Plus size={16} /> New
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {newKey && (
        <p className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-3 py-2">
          Copy your new key now — it won't be shown again: <code className="font-mono">{newKey}</code>
        </p>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-2">
        <DataTable columns={columns} rows={rows} loading={loading}
          onEdit={openEdit} onDelete={remove} readOnly={readOnly} idKey={idKey} />
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={`${editing ? 'Edit' : 'New'} ${title}`}>
        <ResourceForm fields={fields} initial={editing || {}}
          onSubmit={save} onCancel={() => setModalOpen(false)} submitting={submitting} />
      </Modal>
    </div>
  );
}
