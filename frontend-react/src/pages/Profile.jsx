import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { deleteAccount } from '../api/api';

export default function Profile() {
  const { user, isOrganizer, logoutUser } = useAuth();
  const navigate = useNavigate();

  async function handleDeleteAccount() {
    if (!window.confirm('Delete your account permanently? This cannot be undone.')) return;
    try {
      await deleteAccount();
      logoutUser();
      navigate('/');
    } catch (err) {
      window.alert(err.message);
    }
  }

  return (
    <main className="min-h-[calc(100vh-73px)] bg-[#0B0B14] px-6 py-10 text-[#F5F3FF] font-['Manrope']">
      <div className="mx-auto max-w-2xl">
        <p className="mb-2 text-xs uppercase tracking-wide text-[#9C97B8]">Your account</p>
        <h1 className="mb-8 font-['Anton'] text-4xl tracking-tight">PROFILE</h1>

        <section className="overflow-hidden rounded-xl border border-[#262636] bg-[#14141F]">
          <div className="flex items-center gap-4 border-b border-[#262636] px-6 py-6">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#7C3AED] text-xl font-bold">
              {user?.user_name?.charAt(0).toUpperCase() || '?'}
            </span>
            <div>
              <h2 className="text-xl font-semibold">{user?.user_name}</h2>
              <p className="text-sm text-[#9C97B8]">{isOrganizer ? 'Organizer' : 'Event attendee'}</p>
            </div>
          </div>

          <dl className="grid gap-5 px-6 py-6 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-[#9C97B8]">Email</dt>
              <dd className="mt-1 break-words">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[#9C97B8]">Gender</dt>
              <dd className="mt-1 capitalize">{user?.gender?.replaceAll('_', ' ') || 'Not specified'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[#9C97B8]">Member since</dt>
              <dd className="mt-1">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[#9C97B8]">Account status</dt>
              <dd className="mt-1 capitalize">{user?.account_status || 'Active'}</dd>
            </div>
          </dl>
        </section>

        <section className="mt-6 rounded-xl border border-[#FF3D77]/30 bg-[#FF3D77]/5 px-6 py-5">
          <h2 className="font-semibold text-[#FF3D77]">Danger zone</h2>
          <p className="mt-2 text-sm text-[#9C97B8]">
            Accounts with booking history or undeleted events cannot be removed.
          </p>
          <button
            type="button"
            onClick={handleDeleteAccount}
            className="mt-4 rounded-lg border border-[#FF3D77]/60 px-4 py-2 text-sm text-[#FF3D77] hover:bg-[#FF3D77]/10"
          >
            Delete account
          </button>
        </section>

        <Link to="/events" className="mt-6 inline-block text-sm text-[#9C97B8] hover:text-[#F5F3FF]">
          ← Back to events
        </Link>
      </div>
    </main>
  );
}
