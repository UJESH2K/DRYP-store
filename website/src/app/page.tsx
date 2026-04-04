"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useEffect } from "react";
import Link from "next/link";

export default function LandingPage() {
  // Cursor state
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
  const [isHovering, setIsHovering] = useState(false);

  // Swipe Demo State
  const demoImages = [
    "https://images.unsplash.com/photo-1509319117193-57bab727e09d?q=80&w=1000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1608748010899-18f300247112?q=80&w=764&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=1000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1571513800374-df1bbe650e56?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fGZhc2hpb258ZW58MHx8MHx8fDA%3D"
  ];
  const [activeSwipeIndex, setActiveSwipeIndex] = useState(0);
  const [isSwipingOut, setIsSwipingOut] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState('right');

  // Handle global mouse movement for cursor
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Handle Fluid Swipe Demo Automation
  useEffect(() => {
    const swipeInterval = setInterval(() => {
      setSwipeDirection(Math.random() > 0.5 ? 'right' : 'left');
      setIsSwipingOut(true);
      
      setTimeout(() => {
        setActiveSwipeIndex((prev) => (prev + 1) % demoImages.length);
        setIsSwipingOut(false);
      }, 1200); 
      
    }, 4500); 

    return () => clearInterval(swipeInterval);
  }, [demoImages.length]);

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Pinyon+Script&family=Playfair+Display:ital,wght@0,300;0,400;0,500;1,400&display=swap');
        
        .font-editorial { font-family: 'Playfair Display', serif; }
        .font-cursive { font-family: 'Pinyon Script', cursive; }
        
        /* Subtle noise texture */
        .bg-noise {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E");
        }

        /* Ambient Background Animations */
        @keyframes blobBounce {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, -60px) scale(1.1); }
          66% { transform: translate(-30px, 30px) scale(0.9); }
        }

        /* Float Animations */
        @keyframes fadeUpReveal {
          0% { opacity: 0; transform: translateY(30px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(2deg); }
        }

        @keyframes floatSlower {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(20px) rotate(-1deg); }
        }
        
        @keyframes floatFast {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(-3deg); }
        }

        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-100%); }
        }

        /* Animation Classes */
        .animate-blob { animation: blobBounce 25s infinite ease-in-out; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }

        .animate-fade-up {
          animation: fadeUpReveal 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
        
        .animate-float-slow { animation: floatSlow 8s ease-in-out infinite; }
        .animate-float-slower { animation: floatSlower 12s ease-in-out infinite; }
        .animate-float-fast { animation: floatFast 6s ease-in-out infinite; }
        
        .delay-100 { animation-delay: 100ms; }
        .delay-200 { animation-delay: 200ms; }
        .delay-300 { animation-delay: 300ms; }
        .delay-500 { animation-delay: 500ms; }
      `,
        }}
      />

      {/* Custom Animated Cursor */}
      <div 
        className="pointer-events-none fixed left-0 top-0 z-[100] hidden items-center justify-center mix-blend-difference transition-transform duration-300 ease-out md:flex"
        style={{ 
          transform: `translate3d(${mousePos.x}px, ${mousePos.y}px, 0) translate(-50%, -50%) scale(${isHovering ? 2 : 1.2})` 
        }}
      >
        <div className={`flex h-8 w-8 items-center justify-center rounded-full border border-white transition-colors duration-300 ${isHovering ? 'bg-white' : 'bg-transparent'}`}>
          <div className={`h-1 w-1 rounded-full bg-white transition-opacity duration-300 ${isHovering ? 'opacity-0' : 'opacity-100'}`} />
        </div>
      </div>

      {/* Main Wrapper - Black & White Theme */}
      <div className="relative flex min-h-screen w-full flex-col text-black selection:bg-gray-300 selection:text-black overflow-x-hidden font-sans z-0 bg-gradient-to-br from-white via-gray-100 to-gray-200">
        
        {/* Noise Overlay */}
        <div className="absolute inset-0 pointer-events-none z-0 bg-noise mix-blend-overlay opacity-60 fixed"></div>

        {/* Dynamic Background Blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10 fixed">
          <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-gray-300 mix-blend-multiply filter blur-[120px] opacity-70 animate-blob" />
          <div className="absolute top-[20%] right-[-5%] w-[40vw] h-[40vw] rounded-full bg-gray-400 mix-blend-multiply filter blur-[140px] opacity-60 animate-blob animation-delay-2000" />
          <div className="absolute bottom-[-10%] left-[30%] w-[60vw] h-[60vw] rounded-full bg-gray-200 mix-blend-multiply filter blur-[160px] opacity-80 animate-blob animation-delay-4000" />
        </div>

        {/* =========================================
            NAVIGATION
        ========================================= */}
        <header className="fixed top-0 z-50 flex w-full items-center justify-between px-6 py-6 md:px-12 backdrop-blur-md bg-white/20 border-b border-black/5 transition-all duration-500">
          <div 
            className="font-editorial text-2xl tracking-[0.15em] uppercase text-black"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            Dryp
          </div>
          
          <div className="flex items-center gap-12">
            <Link
              href="/login"
              className="text-[10px] font-medium uppercase tracking-[0.2em] text-black transition-all hover:tracking-[0.3em] hover:text-gray-500"
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
            >
              Sign In
            </Link>
          </div>
        </header>

        {/* =========================================
            HERO SECTION
        ========================================= */}
        {/* Changed min-h-[90vh] to min-h-screen md:min-h-[90vh] to stretch full height on mobile */}
        <section className="relative flex min-h-screen md:min-h-screen w-full flex-col items-center justify-center pt-28 pb-12 px-6 md:flex-row md:px-12 md:pt-24 overflow-hidden">
          
          <div className="absolute inset-0 z-0 flex pointer-events-none">
            <div className="w-full md:w-5/12 bg-gray-50" />
            <div className="hidden md:block md:w-7/12 bg-gray-100/40 backdrop-blur-sm border-l border-gray-300/50" />
          </div>

          <div className="relative z-10 flex w-full flex-col justify-center md:w-5/12 md:pr-12">
            <div className="mb-8 flex items-center gap-3 animate-fade-up">
              <div className="h-px w-8 bg-gray-400" />
              <p className="text-[9px] font-medium uppercase tracking-[0.4em] text-gray-500">
                Curation Engine
              </p>
            </div>
            
            <h1 className="font-editorial text-[3.5rem] font-light leading-[1] tracking-tight sm:text-[4.5rem] lg:text-[6.5rem]">
              <span className="block animate-fade-up delay-100">Curate</span>
              <span className="font-cursive text-[4rem] leading-[0.6] text-gray-600 sm:text-[5.5rem] lg:text-[7.5rem] lowercase -ml-4 block py-2 animate-fade-up delay-200">
                your unique
              </span>
              <span className="block animate-fade-up delay-300">Archive.</span>
            </h1>
            
            <p className="mt-8 max-sm:text-[11px] font-light leading-relaxed tracking-[0.15em] uppercase text-gray-500 animate-fade-up delay-300">
              The anti-scroll fashion platform. Instantly discover global designer archives and curate the ultimate digital wishlist with a single gesture.
            </p>

            <div className="mt-10 animate-fade-up delay-500">
              <Link
                href="/signup"
                className="group relative inline-flex items-center gap-6 overflow-hidden border border-gray-300 bg-white/40 backdrop-blur-md px-8 py-4 transition-all duration-700 hover:border-black shadow-lg shadow-black/5"
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
              >
                <div className="absolute inset-0 w-0 bg-black transition-all duration-700 ease-[cubic-bezier(0.87,0,0.13,1)] group-hover:w-full" />
                <span className="relative z-10 text-[10px] font-medium uppercase tracking-[0.3em] text-black transition-colors duration-500 group-hover:text-white">
                  Begin Discovery
                </span>
              </Link>
            </div>
          </div>

          <div className="relative mt-12 flex w-full h-[380px] md:h-[600px] items-center justify-center md:mt-0 md:w-7/12 animate-fade-up delay-300">
            
            {/* Back Image */}
            <div className="absolute right-0 top-0 h-[180px] w-[120px] md:right-[10%] md:top-[5%] md:h-[340px] md:w-[240px] overflow-hidden opacity-70 animate-float-slower shadow-lg">
              <div className="h-full w-full overflow-hidden border border-gray-300/50 bg-gray-100">
                <img 
                  src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1000&auto=format&fit=crop" 
                  alt="High fashion editorial back"
                  className="h-full w-full object-cover scale-110 transition-all duration-700 ease-out mix-blend-multiply opacity-90"
                />
              </div>
            </div>

            {/* Mid Image */}
            <div className="absolute right-[15%] top-[15%] h-[220px] w-[150px] md:right-[25%] md:top-[15%] md:h-[380px] md:w-[260px] overflow-hidden opacity-95 animate-float-slow shadow-xl shadow-black/10 z-10">
              <div className="h-full w-full overflow-hidden border border-white/50 bg-white">
                <img 
                  src="https://images.unsplash.com/photo-1512436991641-6745cdb1723f?q=80&w=1000&auto=format&fit=crop" 
                  alt="Avant garde clothing mid"
                  className="h-full w-full object-cover transition-all duration-700 ease-out hover:scale-105"
                />
              </div>
            </div>

            {/* Front Image */}
            <div className="absolute z-20 left-[5%] top-[10%] h-[260px] w-[180px] md:h-[460px] md:w-[320px] md:left-[15%] md:top-[10%] shadow-2xl shadow-black/20 animate-float-fast">
              <div className="h-full w-full overflow-hidden border border-white/60 bg-white">
                <img 
                  src="https://images.unsplash.com/photo-1539109136881-3be0616acf4b?q=80&w=1000&auto=format&fit=crop" 
                  alt="Avant garde clothing front"
                  className="h-full w-full object-cover transition-all duration-700 ease-out hover:scale-105"
                />
              </div>
              
              <div 
                className="absolute -bottom-4 -right-4 md:-bottom-5 md:-right-5 backdrop-blur-xl bg-white/90 px-4 py-2 md:px-5 md:py-3 border border-gray-300/50 shadow-lg group transition-all duration-500 hover:bg-black"
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
              >
                <span className="text-[7px] md:text-[9px] uppercase tracking-[0.3em] text-black font-medium transition-colors duration-500 group-hover:text-white">
                  SS26 / Selected
                </span>
              </div>
            </div>

          </div>
        </section>

        {/* =========================================
            FEATURES SECTION
        ========================================= */}
        <div className="w-full bg-white relative z-10 border-b border-gray-300/50 border-t">
          <section className="py-24 px-6 md:px-12 w-full max-w-screen-2xl mx-auto cursor-default">
            <div className="mb-20 flex flex-col md:flex-row md:items-end justify-between gap-8">
              <h2 className="font-editorial text-4xl md:text-6xl font-light tracking-tight text-black">
                The <span className="font-cursive text-5xl md:text-7xl text-gray-700 lowercase -ml-2">Interface</span>
              </h2>
              <p className="text-[10px] font-light uppercase tracking-[0.2em] text-gray-500 max-w-xs leading-relaxed">
                Designed for rapid discovery and intuitive curation. We handle the noise, you define the style.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 border-t border-gray-300/50">
              <div className="group flex flex-col justify-between p-8 md:p-12 border-b md:border-b-0 md:border-r border-gray-300/50 transition-colors duration-700 hover:bg-gray-50">
                <div className="mb-20 font-editorial italic text-5xl text-gray-300 transition-all duration-700 group-hover:text-gray-500 group-hover:-translate-y-2">01</div>
                <div>
                  <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.3em] text-black">Rapid Fire</h3>
                  <p className="text-[12px] font-light leading-relaxed text-gray-500">
                    React instantly to global designer collections in our seamless, full-screen feed. Each piece is an opportunity. A swipe is a decision.
                  </p>
                </div>
              </div>

              <div className="group flex flex-col justify-between p-8 md:p-12 border-b md:border-b-0 md:border-r border-gray-300/50 transition-colors duration-700 hover:bg-gray-50">
                <div className="mb-20 font-editorial italic text-5xl text-gray-300 transition-all duration-700 group-hover:text-gray-500 group-hover:-translate-y-2">02</div>
                <div>
                  <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.3em] text-black">The Vault</h3>
                  <p className="text-[12px] font-light leading-relaxed text-gray-500">
                    Your profile is your digital archive. Organize your likes into personalized lookbooks, creating highly specific wishlists for every occasion.
                  </p>
                </div>
              </div>

              <div className="group flex flex-col justify-between p-8 md:p-12 transition-colors duration-700 hover:bg-gray-50">
                <div className="mb-20 font-editorial italic text-5xl text-gray-300 transition-all duration-700 group-hover:text-gray-500 group-hover:-translate-y-2">03</div>
                <div>
                  <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.3em] text-black">Algorithm</h3>
                  <p className="text-[12px] font-light leading-relaxed text-gray-500">
                    DRYP learns your visual language. As you swipe, the algorithm refines its understanding, delivering increasingly accurate style matches.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* =========================================
            LIVE SWIPE DEMO SECTION
        ========================================= */}
        <div className="w-full bg-gray-100 relative z-10 border-b border-gray-300/50">
          <section className="py-32 px-6 md:px-12 w-full overflow-hidden">
            
            <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/4 opacity-[0.03] pointer-events-none">
              <span className="font-editorial text-[25vw] italic text-black whitespace-nowrap">
                React
              </span>
            </div>

            <div className="relative z-10 max-w-screen-2xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
              
              <div className="w-full lg:w-4/12 flex flex-col text-center lg:text-left">
                <div className="mb-8 flex items-center justify-center lg:justify-start gap-4">
                  <span className="text-2xl text-gray-500">✦</span>
                  <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-gray-500">Signal Over Noise</p>
                </div>
                <h2 className="font-editorial text-5xl md:text-7xl lg:text-[5.5rem] font-light tracking-tight text-black mb-8 leading-[1.1]">
                  React. <br/>
                  <span className="font-cursive text-6xl md:text-8xl lg:text-[7.5rem] text-gray-700 lowercase leading-[0.5] block py-4">Instantly.</span>
                </h2>
                <p className="text-[12px] font-light leading-relaxed text-gray-500 max-w-md mx-auto lg:mx-0">
                  A decisive swipe right archives the piece directly to your vault. Swipe left to pass. No carts, no infinite grids. Just instinctual selection building your definitive style profile.
                </p>
              </div>

              <div className="w-full lg:w-8/12 flex items-center justify-center gap-6 xl:gap-12 relative mt-10 lg:mt-0">
                
                {/* Desktop Pass Arrow */}
                <div className="hidden lg:flex flex-col items-center gap-4 opacity-80 z-20 transition-all duration-300">
                  <svg width="100" height="46" viewBox="0 0 60 28" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" className={`text-gray-600 transition-transform duration-500 ${isSwipingOut && swipeDirection === 'left' ? '-translate-x-6 scale-110' : ''}`}>
                    <path d="M50 24 C 35 24, 18 18, 6 8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M6 8 L 18 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M6 8 L 8 20" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className={`font-cursive text-4xl text-gray-600 transition-opacity duration-500 ${isSwipingOut && swipeDirection === 'left' ? 'opacity-100' : 'opacity-60'}`}>Pass</span>
                </div>

                <div className="flex justify-center perspective-[1200px] h-[480px] md:h-[650px] relative w-full max-w-[400px]">
                  
                  {/* Mobile Pass Overlay */}
                  <div className={`absolute left-0 top-1/2 -translate-y-1/2 flex lg:hidden flex-col items-center gap-2 z-40 transition-opacity duration-500 pointer-events-none ${isSwipingOut && swipeDirection === 'left' ? 'opacity-100' : 'opacity-30'}`}>
                      <svg width="40" height="20" viewBox="0 0 60 28" fill="none" stroke="currentColor" className="text-gray-700">
                        <path d="M50 24 C 35 24, 18 18, 6 8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M6 8 L 18 6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M6 8 L 8 20" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="font-cursive text-2xl text-gray-700">Pass</span>
                  </div>

                  {/* Mobile Archive Overlay */}
                  <div className={`absolute right-0 top-1/2 -translate-y-1/2 flex lg:hidden flex-col items-center gap-2 z-40 transition-opacity duration-500 pointer-events-none ${isSwipingOut && swipeDirection === 'right' ? 'opacity-100' : 'opacity-30'}`}>
                      <svg width="40" height="20" viewBox="0 0 60 28" fill="none" stroke="currentColor" className="text-gray-700">
                        <path d="M10 24 C 25 24, 42 18, 54 8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M54 8 L 42 6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M54 8 L 52 20" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="font-cursive text-2xl text-gray-700">Archive</span>
                  </div>

                  <div className="relative w-[260px] md:w-[400px] h-[380px] md:h-[550px] top-1/2 -translate-y-1/2">
                    
                    {demoImages.map((img, index) => {
                      const stackIndex = (index - activeSwipeIndex + demoImages.length) % demoImages.length;
                      
                      let cardStyle = "";
                      let isTop = false;
                      let isSwiping = stackIndex === 0 && isSwipingOut;

                      if (!isSwipingOut) {
                        if (stackIndex === 0) { 
                          cardStyle = "scale-100 translate-y-0 rotate-[-3deg] opacity-100 z-30 shadow-2xl"; 
                          isTop = true; 
                        }
                        else if (stackIndex === 1) { 
                          cardStyle = "scale-[0.95] translate-y-8 rotate-[4deg] opacity-60 z-20 shadow-none"; 
                        }
                        else { 
                          cardStyle = "scale-[0.90] translate-y-16 rotate-[-2deg] opacity-0 z-10 shadow-none"; 
                        }
                      } else {
                        if (stackIndex === 0) {
                          cardStyle = swipeDirection === 'right'
                            ? "translate-x-[110%] translate-y-[15%] rotate-[12deg] opacity-0 z-40 shadow-2xl"
                            : "-translate-x-[110%] translate-y-[15%] -rotate-[12deg] opacity-0 z-40 shadow-2xl";
                          isTop = true;
                        }
                        else if (stackIndex === 1) { 
                          cardStyle = "scale-100 translate-y-0 rotate-[-3deg] opacity-100 z-30 shadow-2xl"; 
                        }
                        else if (stackIndex === 2) { 
                          cardStyle = "scale-[0.95] translate-y-8 rotate-[4deg] opacity-60 z-20 shadow-none"; 
                        }
                        else { 
                          cardStyle = "scale-[0.90] translate-y-16 rotate-[-2deg] opacity-0 z-10 shadow-none"; 
                        }
                      }

                      return (
                        <div
                          key={img}
                          className={`absolute inset-0 transition-all duration-[1200ms] ease-[cubic-bezier(0.25,1,0.35,1)] bg-white overflow-hidden p-2 md:p-4 border border-gray-200 origin-bottom ${cardStyle}`}
                        >
                          <div className="w-full h-full relative overflow-hidden">
                            <img 
                              src={img} 
                              alt="Style Match" 
                              className={`w-full h-full object-cover transition-transform duration-[6s] ease-out ${stackIndex === 0 ? 'scale-105' : 'scale-100'}`} 
                            />
                            
                            <div className={`absolute top-6 md:top-8 w-full px-4 md:px-6 flex justify-between pointer-events-none transition-opacity duration-300 ${isTop ? 'opacity-100' : 'opacity-0'}`}>
                              <div className={`border-2 md:border-4 border-red-600/80 text-red-600/80 font-bold px-2 py-1 md:px-4 md:py-2 text-sm md:text-xl tracking-[0.2em] uppercase transform -rotate-12 transition-all duration-500 ease-out backdrop-blur-sm bg-white/10 ${isSwiping && swipeDirection === 'left' ? 'opacity-100 scale-110' : 'opacity-0 scale-90'}`}>
                                Pass
                              </div>
                              <div className={`border-2 md:border-4 border-gray-800 text-gray-800 font-bold px-2 py-1 md:px-4 md:py-2 text-sm md:text-xl tracking-[0.2em] uppercase transform rotate-12 transition-all duration-500 ease-out backdrop-blur-sm bg-white/10 ${isSwiping && swipeDirection === 'right' ? 'opacity-100 scale-110' : 'opacity-0 scale-90'}`}>
                                Archive
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Desktop Archive Arrow */}
                <div className="hidden lg:flex flex-col items-center gap-4 opacity-80 z-20 transition-all duration-300">
                  <svg width="100" height="46" viewBox="0 0 60 28" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" className={`text-gray-600 transition-transform duration-500 ${isSwipingOut && swipeDirection === 'right' ? 'translate-x-4 scale-110' : ''}`}>
                    <path d="M10 24 C 25 24, 42 18, 54 8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M54 8 L 42 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M54 8 L 52 20" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className={`font-cursive text-4xl text-gray-600 transition-opacity duration-500 ${isSwipingOut && swipeDirection === 'right' ? 'opacity-100' : 'opacity-60'}`}>Archive</span>
                </div>

              </div>

            </div>
          </section>
        </div>

        {/* =========================================
            FINAL CTA & FOOTER
        ========================================= */}
        <section className="relative py-40 flex flex-col items-center justify-center bg-gray-50 px-6 text-center overflow-hidden z-10 border-b border-gray-300/30">
          
          <div className="absolute top-[20%] left-[10%] animate-float-slow opacity-30 pointer-events-none">
            <span className="text-3xl text-gray-400">✦</span>
          </div>
          <div className="absolute bottom-[20%] right-[15%] animate-float-slower opacity-20 pointer-events-none">
            <span className="text-5xl text-gray-400">✦</span>
          </div>
          <div className="absolute top-[40%] right-[5%] animate-float-slow opacity-10 pointer-events-none mix-blend-multiply">
            <div className="h-32 w-32 rounded-full border border-gray-400/50"></div>
          </div>

          {/* Left Side Images (4 total) */}
          <div className="absolute left-[-5%] top-[5%] h-[160px] w-[110px] md:left-[5%] md:top-[10%] md:h-[260px] md:w-[180px] block lg:block overflow-hidden opacity-30 md:opacity-90 animate-float-slow shadow-xl transform -rotate-6 border border-gray-300 z-0 md:z-10 pointer-events-none">
            <img src="https://images.unsplash.com/photo-1618932260643-eee4a2f652a6?q=80&w=800&auto=format&fit=crop" alt="Curated style left 1" className="h-full w-full object-cover transition-all duration-700 hover:scale-105" />
          </div>
          
          <div className="absolute left-[5%] bottom-[30%] h-[140px] w-[90px] md:left-[18%] md:bottom-[15%] md:h-[200px] md:w-[150px] block lg:block overflow-hidden opacity-20 md:opacity-80 animate-float-slower shadow-lg transform rotate-3 border border-gray-300 z-0 md:z-10 pointer-events-none">
            <img src="https://plus.unsplash.com/premium_photo-1675186049419-d48f4b28fe7c?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8ZmFzaGlvbnxlbnwwfHwwfHx8MA%3D%3D" alt="Curated style left 2" className="h-full w-full object-cover transition-all duration-700 hover:scale-105" />
          </div>

          <div className="absolute left-[2%] bottom-[25%] h-[160px] w-[120px] hidden lg:block overflow-hidden opacity-75 animate-float-fast shadow-xl transform -rotate-12 border border-gray-300 z-0 pointer-events-none">
            <img src="https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTR8fGNsb3RoZXN8ZW58MHx8MHx8fDA%3D" alt="Curated style left 3" className="h-full w-full object-cover transition-all duration-700 hover:scale-105" />
          </div>

          <div className="absolute left-[22%] top-[5%] h-[180px] w-[140px] hidden lg:block overflow-hidden opacity-85 animate-float-slower shadow-lg transform rotate-6 border border-gray-300 z-0 pointer-events-none">
            <img src="https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=800&auto=format&fit=crop" alt="Curated style left 4" className="h-full w-full object-cover transition-all duration-700 hover:scale-105" />
          </div>

          {/* Right Side Images (4 total) */}
          <div className="absolute right-[-5%] top-[12%] h-[150px] w-[100px] md:right-[8%] md:top-[15%] md:h-[220px] md:w-[160px] block lg:block overflow-hidden opacity-25 md:opacity-85 animate-float-fast shadow-xl transform rotate-6 border border-gray-300 z-0 md:z-10 pointer-events-none">
            <img src="https://images.unsplash.com/photo-1543163521-1bf539c55dd2?q=80&w=800&auto=format&fit=crop" alt="Curated style right 1" className="h-full w-full object-cover transition-all duration-700 hover:scale-105" />
          </div>

          <div className="absolute right-[-10%] bottom-[15%] h-[200px] w-[140px] md:right-[20%] md:bottom-[10%] md:h-[280px] md:w-[200px] block lg:block overflow-hidden opacity-30 md:opacity-95 animate-float-slow shadow-2xl transform -rotate-3 border border-gray-300 z-0 md:z-10 pointer-events-none">
            <img src="https://images.unsplash.com/photo-1612423284934-2850a4ea6b0f?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MzV8fGNsb3RoZXN8ZW58MHx8MHx8fDA%3D" alt="Curated style right 2" className="h-full w-full object-cover transition-all duration-700 hover:scale-105" />
          </div>

          <div className="absolute right-[4%] bottom-[30%] h-[240px] w-[140px] hidden lg:block overflow-hidden opacity-75 animate-float-slower shadow-lg transform rotate-12 border border-gray-300 z-0 pointer-events-none">
            <img src="https://images.unsplash.com/photo-1540221652346-e5dd6b50f3e7?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Y2xvdGhlc3xlbnwwfHwwfHx8MA%3D%3D" alt="Curated style right 3" className="h-full w-full object-cover transition-all duration-700 hover:scale-105" />
          </div>

          <div className="absolute right-[25%] top-[8%] h-[150px] w-[110px] hidden lg:block overflow-hidden opacity-80 animate-float-fast shadow-md transform -rotate-6 border border-gray-300 z-0 pointer-events-none">
            <img src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MjR8fGNsb3RoZXN8ZW58MHx8MHx8fDA%3D" alt="Curated style right 4" className="h-full w-full object-cover transition-all duration-700 hover:scale-105" />
          </div>

          <h2 className="relative z-10 font-editorial text-5xl md:text-7xl font-light tracking-tight mb-8 mt-12 md:mt-0">
            Find your <span className="font-cursive text-6xl md:text-8xl text-gray-700 lowercase">match.</span>
          </h2>
          <p className="relative z-10 text-[10px] font-light uppercase tracking-[0.3em] text-gray-500 mb-14 max-w-md leading-relaxed">
            Join the new wave of digital style curation. Your unique fashion identity awaits.
          </p>
          
          <Link
            href="/signup"
            className="group relative z-10 inline-flex items-center justify-center px-14 py-6 text-[10px] font-bold uppercase tracking-[0.3em] text-white bg-black overflow-hidden shadow-2xl shadow-black/10 hover:shadow-black/20 transition-all duration-500 hover:-translate-y-1"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            <div className="absolute inset-0 h-full w-full translate-y-full bg-gray-800 transition-transform duration-700 ease-[cubic-bezier(0.87,0,0.13,1)] group-hover:translate-y-0" />
            <span className="relative z-10 transition-colors duration-500">
              Enter The Feed
            </span>
          </Link>
        </section>

        <footer className="relative z-10 flex w-full flex-col items-center justify-between gap-6 px-6 py-12 md:flex-row md:px-12 bg-gray-50">
          <p className="text-[9px] font-medium tracking-[0.3em] uppercase text-gray-500">
            &copy; {new Date().getFullYear()} DRYP SYNDICATE
          </p>

          <div className="flex space-x-12 text-[9px] font-medium tracking-[0.3em] uppercase text-gray-500">
            <span 
              className="cursor-pointer transition-colors duration-500 hover:text-black"
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
            >
              Terms of Service
            </span>
            <span 
              className="cursor-pointer transition-colors duration-500 hover:text-black"
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
            >
              Privacy Policy
            </span>
          </div>
        </footer>

      </div>
    </>
  );
}