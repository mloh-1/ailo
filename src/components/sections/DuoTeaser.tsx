import Link from "next/link";

export function DuoTeaser() {
  return (
    <section className="section bg-[var(--color-background)]">
      <div className="container-custom">
        <div className="card-gold p-8 md:p-12">
          <div className="max-w-3xl mx-auto text-center">
            {/* Badge */}
            <span className="tag-dark mb-4">
              Already Dating Someone?
            </span>

            {/* Headline */}
            <h2 className="font-[var(--font-playfair)] text-3xl md:text-4xl font-bold text-[var(--color-text-inverse)] mt-4 mb-4">
              Understand Your Relationship Dynamics
            </h2>

            {/* Description */}
            <p className="text-[var(--color-text-inverse)]/80 mb-8 max-w-xl mx-auto">
              Take the compatibility assessment together. Discover why you connect,
              where you might clash, and how to grow stronger as a couple.
            </p>

            {/* Features */}
            <div className="grid sm:grid-cols-3 gap-6 mb-8">
              <div className="text-center">
                <div className="gray-circle w-12 h-12 mx-auto mb-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="text-[var(--color-text-inverse)]/80 text-sm">See your compatibility score</p>
              </div>
              <div className="text-center">
                <div className="gray-circle w-12 h-12 mx-auto mb-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-[var(--color-text-inverse)]/80 text-sm">Understand communication styles</p>
              </div>
              <div className="text-center">
                <div className="gray-circle w-12 h-12 mx-auto mb-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-[var(--color-text-inverse)]/80 text-sm">Get relationship insights</p>
              </div>
            </div>

            {/* CTA */}
            <Link
              href="/duo"
              className="inline-block bg-[var(--color-text-inverse)] text-[var(--color-accent)] font-semibold px-8 py-4 rounded-full hover:bg-white transition-colors"
            >
              Try AILO Duo
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
