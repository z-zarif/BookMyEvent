import { Link } from 'react-router-dom';

const TICKER_ITEMS = [
  'Arctic Waves — Fri, Nov 14',
  'The Midnight Parade — Sat, Nov 22',
  'Solstice Fest — Dec 5–7',
  'Neon Static — Thu, Dec 12',
  'Echo Chamber Live — Sun, Dec 21',
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0B0B14] text-[#F5F3FF] font-['Manrope'] flex flex-col relative overflow-hidden">
      {/* Grain texture over everything, purely additive */}
      <div className="grain-overlay" />

      {/* Stage-light glow behind the wordmark */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full opacity-30 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #7C3AED 0%, #FF3D77 45%, transparent 70%)' }}
      />

      {/* Top bar */}
      <header className="relative z-10 flex justify-end items-center gap-3 px-8 py-6">
        <Link
          to="/login"
          className="text-sm text-[#F5F3FF]/80 hover:text-white transition-colors px-2"
        >
          Login
        </Link>
        <Link
          to="/register"
          className="text-sm font-semibold px-5 py-2 rounded-full bg-white text-[#0B0B14] hover:bg-[#F5F3FF] transition-colors"
        >
          Sign up
        </Link>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6">
        <span className="text-xs tracking-wide text-[#9C97B8] mb-4">
          Live shows. Real seats. No refresh-and-pray.
        </span>

        <h1 className="font-['Anton'] text-[clamp(3.5rem,14vw,9rem)] leading-[0.9] tracking-tight">
          EVENTIA
        </h1>

        <p className="mt-6 text-[#9C97B8] text-lg max-w-md">
          Find the show. Grab the ticket. Be in the room when it happens.
        </p>

        <div className="mt-10 flex items-center gap-4 flex-wrap justify-center">
          <Link
            to="/register"
            className="text-sm font-semibold px-8 py-3.5 rounded-full text-white transition-transform hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #FF3D77, #7C3AED)' }}
          >
            Get your ticket
          </Link>
          <Link
            to="/events"
            className="text-sm text-[#F5F3FF]/80 hover:text-white transition-colors underline underline-offset-4 decoration-[#9C97B8]/40"
          >
            Browse what's on
          </Link>
        </div>
      </main>

      {/* Marquee ticker — scrolling venue-style reel of upcoming shows */}
      <div className="relative z-10 border-t border-[#262636] py-4 overflow-hidden">
        <div className="flex whitespace-nowrap marquee-track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} className="mx-6 text-sm text-[#9C97B8] flex items-center gap-6">
              {item}
              <span className="text-[#FF3D77]">●</span>
            </span>
          ))}
        </div>
      </div>

      <footer className="relative z-10 text-center text-xs text-[#9C97B8]/70 py-5">
        © {new Date().getFullYear()} Eventia
      </footer>
    </div>
  );
}
