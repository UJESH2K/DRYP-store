import Link from "next/link";

export default function LandingPage() {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Pinyon+Script&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap');
        .font-editorial { font-family: 'Playfair Display', serif; }
        .font-cursive { font-family: 'Pinyon Script', cursive; }
      `,
        }}
      />

      <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#050505] selection:bg-[#E8E6DF] selection:text-black">
        {/* --- ABSTRACT BACKGROUND LAYER --- */}
        {/* Deep moody aura blurs (Mesh Gradient effect) */}
        <div className="absolute -left-[20%] -top-[20%] h-[70vw] w-[70vw] rounded-full bg-zinc-800/20 blur-[120px]" />
        <div className="absolute -bottom-[20%] -right-[10%] h-[60vw] w-[60vw] rounded-full bg-[#2a2422]/30 blur-[150px]" />

        {/* --- CINEMATIC IMAGE LAYER --- */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&w=2070&auto=format&fit=crop"
            alt="High Fashion Editorial Silhouette"
            className="h-full w-full object-cover opacity-40 mix-blend-luminosity transition-transform duration-[40s] ease-out hover:scale-110"
          />
          {/* Refined gradient overlay: Top and bottom vignette instead of a full dull cover */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-transparent to-[#050505]" />
        </div>

        {/* --- ABSTRACT GEOMETRY LAYER --- */}
        {/* Impossibly thin vertical tracking line (Spine) */}
        <div className="absolute left-1/2 top-0 z-0 h-full w-[1px] -translate-x-1/2 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

        {/* Giant, slow-rotating ultra-thin abstract ring */}
        <div className="absolute left-1/2 top-1/2 z-0 h-[120vh] w-[120vh] -translate-x-1/2 -translate-y-1/2 animate-[spin_120s_linear_infinite] rounded-full border border-white/[0.04]" />
        <div className="absolute left-1/2 top-1/2 z-0 h-[80vh] w-[80vh] -translate-x-1/2 -translate-y-1/2 animate-[spin_80s_linear_infinite_reverse] rounded-full border border-white/[0.02] border-dashed" />

        {/* Minimalist Header */}
        <header className="absolute top-0 z-20 flex w-full items-center justify-between px-8 py-10 sm:px-16 md:px-24 text-white/90">
          <div className="font-editorial text-2xl italic tracking-[0.2em]">
            DR-YP
          </div>
          <div className="flex items-center gap-6">
            <span className="hidden text-[9px] uppercase tracking-[0.4em] text-white/40 md:block">
              Syndicate Access
            </span>
            <div className="h-[1px] w-8 bg-white/30 hidden md:block" />
            <Link
              href="/login"
              className="font-sans text-[10px] font-bold uppercase tracking-[0.3em] transition-all hover:tracking-[0.4em] hover:text-white"
            >
              Sign In
            </Link>
          </div>
        </header>

        {/* Main Hero Content */}
        <main className="relative z-10 flex w-full max-w-5xl flex-col items-center px-6 text-center">
          <div className="relative">
            {/* Small abstract accent text above the main header */}
            <p className="mb-8 font-sans text-[9px] font-medium uppercase tracking-[0.5em] text-[#E8E6DF]/60">
              [ Studio Initialization ]
            </p>

            <h2 className="font-editorial text-6xl font-light leading-[1.05] tracking-tight text-white sm:text-7xl md:text-[6rem]">
              Streamline the <br />
              <span className="block pt-6 md:pt-10 font-cursive text-[6.5rem] font-normal leading-[0.5] text-[#fcc203] sm:text-[10rem] md:text-[13rem]">
                storefront.
              </span>
            </h2>
          </div>

          <p className="mt-14 max-w-lg font-sans text-[10px] font-light leading-relaxed tracking-[0.25em] text-white/60 uppercase sm:text-xs">
            The exclusive platform to upload collections, manage archives, and
            track global sales. Focus on the art, we handle the commerce.
          </p>

          <div className="mt-16">
            <Link
              href="/signup"
              className="group relative inline-flex overflow-hidden border border-white/20 bg-transparent px-10 py-5 text-[11px] font-medium uppercase tracking-[0.3em] text-white backdrop-blur-sm transition-all duration-500 hover:border-white hover:tracking-[0.4em]"
            >
              <div className="absolute inset-0 h-full w-full translate-y-[100%] bg-white transition-transform duration-700 ease-[cubic-bezier(0.87,0,0.13,1)] group-hover:translate-y-0" />
              <span className="relative z-10 mix-blend-difference transition-colors duration-500">
                Apply for Access
              </span>
            </Link>
          </div>
        </main>

        {/* Minimalist Footer */}
        <footer className="absolute bottom-0 z-20 flex w-full flex-col items-center justify-between gap-6 px-8 py-10 sm:flex-row sm:px-16 md:px-24">
          <p className="text-[9px] tracking-[0.3em] uppercase text-white/40">
            &copy; {new Date().getFullYear()} DR-YP Syndicate
          </p>

          {/* Abstract coordinates accent (common in high-end design) */}
          <div className="hidden text-[9px] tracking-[0.4em] text-white/20 lg:block">
            48°52&apos;5.67&quot;N · 2°19&apos;59.80&quot;E
          </div>

          <div className="flex space-x-8 text-[9px] tracking-[0.3em] uppercase text-white/40">
            <span className="cursor-pointer hover:text-white transition-colors">
              Terms
            </span>
            <span className="cursor-pointer hover:text-white transition-colors">
              Privacy
            </span>
          </div>
        </footer>
      </div>
    </>
  );
}
