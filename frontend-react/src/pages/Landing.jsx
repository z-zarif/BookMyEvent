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
    <div className="min-h-screen bg-[#0B0B14] text-[#F5F3FF] font-['Manrope'] flex flex-col">
      <header className="flex justify-end items-center gap-3 px-8 py-6">
        <Link to="/login" className="text-sm text-[#F5F3FF]/70 hover:text-white transition-colors px-2">
          Login
        </Link>
        <Link
          to="/register"
          className="text-sm font-semibold px-5 py-2 rounded-full bg-white text-[#0B0B14] hover:bg-[#F5F3FF] transition-colors"
        >
          Sign up
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-6">
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
            className="text-sm font-semibold px-8 py-3.5 rounded-full bg-[#7C3AED] text-white hover:bg-[#6D2FE0] transition-colors"
          >
            Get your ticket
          </Link>
          <Link
            to="/events"
            className="text-sm text-[#F5F3FF]/70 hover:text-white transition-colors underline underline-offset-4 decoration-[#9C97B8]/40"
          >
            Browse what's on
          </Link>
        </div>

        <div className="mt-20 flex items-center gap-6 text-sm text-[#9C97B8] flex-wrap justify-center">
          <span>Instant booking</span>
          <span className="w-px h-4 bg-[#262636]" />
          <span>Wallet payments</span>
          <span className="w-px h-4 bg-[#262636]" />
          <span>No hidden fees</span>
        </div>
      </main>

      <div className="border-t border-[#262636] py-4 overflow-hidden">
        <div className="flex whitespace-nowrap marquee-track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} className="mx-6 text-sm text-[#9C97B8] flex items-center gap-6">
              {item}
              <span className="text-[#7C3AED]">●</span>
            </span>
          ))}
        </div>
      </div>

      <footer className="text-center text-xs text-[#9C97B8]/60 py-5">
        © {new Date().getFullYear()} Eventia
      </footer>
    </div>
  );
}
