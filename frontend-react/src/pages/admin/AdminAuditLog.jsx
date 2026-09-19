import { useEffect, useState } from 'react';
import { getAuditLog } from '../../api/api';

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

export default function AdminAuditLog() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAuditLog()
      .then(setLogs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl">
      <h1 className="font-['Anton'] text-3xl tracking-tight mb-2">TICKET AUDIT LOG</h1>
      <p className="text-[#9C97B8] text-sm mb-6">
        Written automatically by the database trigger whenever a ticket type's
        quantity or status changes — including every booking and cancellation.
      </p>

      {error && (
        <p className="text-[#FF3D77] text-sm bg-[#FF3D77]/10 border border-[#FF3D77]/30 rounded-lg px-4 py-3 mb-4">
          {error}
        </p>
      )}
      {loading && <p className="text-[#9C97B8]">Loading...</p>}
      {!loading && logs.length === 0 && !error && (
        <p className="text-[#9C97B8]">
          No changes logged yet. Make a booking and refresh — a row should appear.
        </p>
      )}

      {logs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#9C97B8] text-xs uppercase tracking-wide border-b border-[#1C1C2A]">
                <th className="py-3 pr-4 font-normal">Event</th>
                <th className="py-3 pr-4 font-normal">Category</th>
                <th className="py-3 pr-4 font-normal">Quantity</th>
                <th className="py-3 pr-4 font-normal">Status</th>
                <th className="py-3 font-normal">Changed At</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.log_id} className="border-b border-[#1C1C2A]">
                  <td className="py-3 pr-4">{l.event_title}</td>
                  <td className="py-3 pr-4 text-[#9C97B8]">{l.category}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {l.old_quantity !== l.new_quantity ? (
                      <span>
                        <span className="text-[#9C97B8]">{l.old_quantity}</span>
                        <span className="text-[#9C97B8]/50 mx-1.5">→</span>
                        <span
                          className={
                            l.new_quantity < l.old_quantity ? 'text-[#FF3D77]' : 'text-[#4ADE80]'
                          }
                        >
                          {l.new_quantity}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[#9C97B8]/40">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {l.old_status !== l.new_status ? (
                      <span>
                        <span className="text-[#9C97B8]">{l.old_status}</span>
                        <span className="text-[#9C97B8]/50 mx-1.5">→</span>
                        <span>{l.new_status}</span>
                      </span>
                    ) : (
                      <span className="text-[#9C97B8]/40">—</span>
                    )}
                  </td>
                  <td className="py-3 text-[#9C97B8]/60 text-xs whitespace-nowrap">
                    {formatDate(l.changed_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
