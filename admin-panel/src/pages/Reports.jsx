import { useEffect, useState } from 'react';
import { getReports } from '../api/api';

const money = (value) => `৳${Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

function Table({ columns, rows, empty }) {
  return rows.length === 0 ? (
    <p className="text-[#9C97B8] py-4">{empty}</p>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[#9C97B8] text-xs uppercase tracking-wide border-b border-[#1C1C2A]">
            {columns.map(([label]) => <th key={label} className="py-3 pr-4 font-normal whitespace-nowrap">{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.event_id || row.user_id || row.promo_id || index} className="border-b border-[#1C1C2A]">
              {columns.map(([label, render]) => <td key={label} className="py-3 pr-4 whitespace-nowrap">{render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Reports() {
  const [reports, setReports] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getReports().then(setReports).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="max-w-6xl space-y-10">
      <div>
        <h1 className="font-['Anton'] text-3xl tracking-tight mb-2">REPORTS</h1>
        <p className="text-[#9C97B8] text-sm">Admin-only sales, occupancy, customer, promo, and wishlist reporting.</p>
      </div>
      {error && <p className="text-[#FF3D77] text-sm bg-[#FF3D77]/10 border border-[#FF3D77]/30 rounded-lg px-4 py-3">{error}</p>}
      {!reports && !error && <p className="text-[#9C97B8]">Loading...</p>}
      {reports && (
        <>
          <section>
            <h2 className="font-['Anton'] text-xl mb-3">ORGANIZER REVENUE</h2>
            <Table rows={reports.revenue} empty="No sales yet." columns={[
              ['Organizer', (r) => r.organizer_id], ['Event', (r) => r.title],
              ['Status', (r) => r.event_status], ['Tickets Sold', (r) => r.tickets_sold],
              ['Revenue', (r) => <span className="font-semibold">{money(r.total_revenue)}</span>],
            ]} />
          </section>
          <section>
            <h2 className="font-['Anton'] text-xl mb-3">EVENT OCCUPANCY</h2>
            <Table rows={reports.occupancy} empty="No events yet." columns={[
              ['Event', (r) => r.title], ['Capacity', (r) => r.total_capacity],
              ['Sold', (r) => r.tickets_sold], ['Fill', (r) => r.fill_percentage == null ? '—' : `${r.fill_percentage}%`],
            ]} />
          </section>
          <section>
            <h2 className="font-['Anton'] text-xl mb-3">TOP CUSTOMERS BY SPEND</h2>
            <Table rows={reports.customers} empty="No paid bookings yet." columns={[
              ['Customer', (r) => r.user_name], ['Email', (r) => r.email],
              ['Paid Bookings', (r) => r.paid_booking_count], ['Total Spend', (r) => <span className="font-semibold">{money(r.total_spend)}</span>],
            ]} />
          </section>
          <section>
            <h2 className="font-['Anton'] text-xl mb-3">PROMO EFFECTIVENESS</h2>
            <Table rows={reports.promos} empty="No promo codes yet." columns={[
              ['Code', (r) => r.code], ['Status', (r) => r.status],
              ['Redemptions', (r) => r.redemption_count], ['Discount Given', (r) => money(r.total_discount_given)],
            ]} />
          </section>
          <section>
            <h2 className="font-['Anton'] text-xl mb-3">MOST WISHLISTED EVENTS</h2>
            <Table rows={reports.wishlists} empty="No events yet." columns={[
              ['Event', (r) => r.title], ['Status', (r) => r.event_status],
              ['Wishlist Adds', (r) => r.wishlist_count],
            ]} />
          </section>
        </>
      )}
    </div>
  );
}
