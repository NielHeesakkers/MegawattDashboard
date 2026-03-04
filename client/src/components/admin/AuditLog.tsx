import { useState, useEffect } from 'react';
import { fetchAuditLogs, AuditLogEntry } from '../../api';

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = async (p: number) => {
    const data = await fetchAuditLogs(p);
    setLogs(data.logs);
    setTotalPages(data.pages);
    setPage(data.page);
  };

  useEffect(() => { load(1); }, []);

  const actionColors: Record<string, string> = {
    CREATE: 'bg-green-500/20 text-green-400',
    UPDATE: 'bg-blue-500/20 text-blue-400',
    DELETE: 'bg-red-500/20 text-red-400',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">Audit Log</h1>

      <div className="bg-bg-card rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-text-secondary text-left">
              <th className="px-4 py-3">Datum</th>
              <th className="px-4 py-3">Actie</th>
              <th className="px-4 py-3">Entiteit</th>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Door</th>
              <th className="px-4 py-3">Wijzigingen</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              let changes: Record<string, unknown> = {};
              try { changes = JSON.parse(log.changes); } catch {}

              return (
                <tr key={log.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-2 text-text-secondary">
                    {new Date(log.createdAt).toLocaleString('nl-NL')}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${actionColors[log.action] || ''}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-text-primary">{log.entity}</td>
                  <td className="px-4 py-2 text-text-secondary">{log.entityId}</td>
                  <td className="px-4 py-2 text-text-secondary">{log.performedBy}</td>
                  <td className="px-4 py-2 text-text-secondary text-xs max-w-xs truncate">
                    {Object.entries(changes).map(([k, v]) => `${k}: ${v}`).join(', ')}
                  </td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-text-secondary">Geen logs gevonden</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => load(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1 rounded bg-white/10 text-text-primary text-sm disabled:opacity-30"
          >
            Vorige
          </button>
          <span className="px-3 py-1 text-text-secondary text-sm">
            Pagina {page} van {totalPages}
          </span>
          <button
            onClick={() => load(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1 rounded bg-white/10 text-text-primary text-sm disabled:opacity-30"
          >
            Volgende
          </button>
        </div>
      )}
    </div>
  );
}
