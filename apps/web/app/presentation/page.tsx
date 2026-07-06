'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Slide {
  id: number;
  title: string;
  subtitle?: string;
  phase?: string;
  type: 'cover' | 'split' | 'grid' | 'visual';
  content: React.ReactNode;
}

export default function PresentationPage() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides: Slide[] = [
    {
      id: 1,
      title: "IMPEACHMENT INTELLIGENCE PLATFORM",
      subtitle: "PRODUCT SCOPE & NARRATIVE ARCHITECTURE",
      phase: "PHASE 00",
      type: "cover",
      content: (
        <div className="flex flex-col justify-center h-full space-y-6">
          <div className="relative inline-block px-4 py-2 border-2 border-red-600 bg-black/80 rotate-[-1deg] shadow-[4px_4px_0px_#E51E25] max-w-fit">
            <span className="font-mono text-sm tracking-widest text-red-500 uppercase">CLASSIFIED // PHILIPPINES OSINT</span>
          </div>
          <h1 className="text-6xl md:text-8xl font-display font-black text-white leading-tight uppercase tracking-tight">
            IIP <span className="text-red-600 block md:inline">SYSTEM</span> <span className="text-red-500">SCOPE</span>
          </h1>
          <p className="max-w-xl text-lg text-zinc-400 font-sans font-light leading-relaxed">
            An AI-powered political intelligence framework designed to ingest, process, and map complex political documentation into an explainable, graph-indexed database of evidence.
          </p>
          <div className="pt-8 flex items-center space-x-4">
            <span className="font-mono text-zinc-500 text-xs">[ PRESS SPACE OR ARROW KEYS TO NAVIGATE ]</span>
          </div>
        </div>
      )
    },
    {
      id: 2,
      title: "THE CORE PROBLEM & VISION",
      subtitle: "WHY THE PLATFORM EXISTS",
      phase: "METRICS",
      type: "split",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center h-full">
          <div className="space-y-6">
            <div className="border-l-4 border-red-600 pl-6 space-y-4">
              <h3 className="font-display text-3xl font-bold text-white uppercase italic">The Chaos of Ingestion</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Philippine legislative and impeachment hearings generate hundreds of hours of raw transcripts, conflicting media reports, and unsorted PDF evidence. Unassisted human analysis is too slow and prone to bias.
              </p>
            </div>
            <div className="border-l-4 border-zinc-700 pl-6 space-y-4">
              <h3 className="font-display text-3xl font-bold text-red-500 uppercase italic">The Graph Answer</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                By automating entity extraction and linking them with direct citations, we construct a verifiably explainable timeline of events where every connection is backed by an audited source.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 border-2 border-zinc-800 bg-zinc-950/60 rounded-lg relative overflow-hidden group hover:border-red-600 transition-colors duration-300">
              <div className="absolute right-0 bottom-0 opacity-10 font-mono text-7xl text-zinc-500 font-black">DATA</div>
              <div className="text-5xl font-black text-white font-sans tracking-tighter mb-2">100K+</div>
              <div className="text-xs font-mono text-red-500 uppercase tracking-widest">DOCUMENTS CAPABLE</div>
            </div>
            <div className="p-6 border-2 border-zinc-800 bg-zinc-950/60 rounded-lg relative overflow-hidden group hover:border-red-600 transition-colors duration-300">
              <div className="absolute right-0 bottom-0 opacity-10 font-mono text-7xl text-zinc-500 font-black">SPEED</div>
              <div className="text-5xl font-black text-red-600 font-sans tracking-tighter mb-2">24/7</div>
              <div className="text-xs font-mono text-zinc-400 uppercase tracking-widest">LIVE INGESTION FEEDS</div>
            </div>
            <div className="p-6 border-2 border-zinc-800 bg-zinc-950/60 rounded-lg relative overflow-hidden group hover:border-red-600 transition-colors duration-300">
              <div className="absolute right-0 bottom-0 opacity-10 font-mono text-7xl text-zinc-500 font-black">GRAPH</div>
              <div className="text-5xl font-black text-white font-sans tracking-tighter mb-2">1.2M</div>
              <div className="text-xs font-mono text-red-500 uppercase tracking-widest">EXPECTED ENTITY NODES</div>
            </div>
            <div className="p-6 border-2 border-zinc-800 bg-zinc-950/60 rounded-lg relative overflow-hidden group hover:border-red-600 transition-colors duration-300">
              <div className="absolute right-0 bottom-0 opacity-10 font-mono text-7xl text-zinc-500 font-black">TRUTH</div>
              <div className="text-5xl font-black text-red-600 font-sans tracking-tighter mb-2">100%</div>
              <div className="text-xs font-mono text-zinc-400 uppercase tracking-widest">EXPLAINABLE CITATIONS</div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 3,
      title: "CAPABILITY: CONTINUOUS INGESTION",
      subtitle: "FROM RAW DOCUMENTS TO PROCESSED DATA",
      phase: "PHASE 01",
      type: "visual",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center h-full">
          <div className="lg:col-span-5 space-y-6">
            <h3 className="text-4xl font-display font-black text-white uppercase tracking-tight">
              THE INTEL <span className="text-red-600">DASHBOARD</span>
            </h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Our first phase establishes an ingestion pipeline processing Government Gazette files, news feeds, and PDFs. It extracts entities, authors, and classification levels dynamically.
            </p>
            <ul className="space-y-3 font-mono text-xs text-zinc-300">
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 bg-red-600 rounded-full" />
                <span>MULTILANGUAGE OCR (TAGALOG & ENGLISH)</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 bg-red-600 rounded-full" />
                <span>INTELLIGENCE SOURCE CLASSIFICATION</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 bg-red-600 rounded-full" />
                <span>AUTOMATED RECORD ARCHIVING</span>
              </li>
            </ul>
          </div>
          <div className="lg:col-span-7 relative border-4 border-red-600/80 bg-zinc-950 p-2 shadow-[8px_8px_0px_#111] group hover:border-red-600 transition-all duration-300 transform hover:scale-[1.01]">
            <div className="absolute top-4 left-4 z-10 px-2 py-1 bg-red-600 text-white font-mono text-xs font-bold uppercase tracking-wider">
              HIGH-FIDELITY INTERFACE MOCK
            </div>
            <img 
              src="/images/dashboard.jpg" 
              alt="IIP Intelligence Dashboard" 
              className="w-full h-auto object-cover rounded border border-zinc-800"
            />
          </div>
        </div>
      )
    },
    {
      id: 4,
      title: "CAPABILITY: KNOWLEDGE GRAPH EXPLORER",
      subtitle: "MAPPING RELATIONSHIPS & CONFLICTS",
      phase: "PHASE 02",
      type: "visual",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center h-full">
          <div className="lg:col-span-7 relative border-4 border-red-600/80 bg-zinc-950 p-2 shadow-[8px_8px_0px_#111] group hover:border-red-600 transition-all duration-300 transform hover:scale-[1.01] order-2 lg:order-1">
            <div className="absolute top-4 left-4 z-10 px-2 py-1 bg-red-600 text-white font-mono text-xs font-bold uppercase tracking-wider">
              ENTITY RELATIONSHIP NETWORK
            </div>
            <img 
              src="/images/graph.jpg" 
              alt="IIP Knowledge Graph" 
              className="w-full h-auto object-cover rounded border border-zinc-800"
            />
          </div>
          <div className="lg:col-span-5 space-y-6 order-1 lg:order-2">
            <h3 className="text-4xl font-display font-black text-white uppercase tracking-tight">
              THE INTEL <span className="text-red-500">MAP</span>
            </h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Powered by Apache AGE and PostgreSQL pgvector, this visual engine connects individuals, organizations, and statements, pointing out contradictions in real-time.
            </p>
            <ul className="space-y-3 font-mono text-xs text-zinc-300">
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                <span>APACHE AGE GRAPH DATABASE INTEGRATION</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                <span>SEMANTIC VECTOR SEARCH OVER NODE STATEMENTS</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                <span>REAL-TIME THREAT & CONTRADICTION DETECTOR</span>
              </li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 5,
      title: "IMPLEMENTATION TIMELINE & MILESTONES",
      subtitle: "OUR ROADMAP TO LAUNCH",
      phase: "PHASE 03",
      type: "grid",
      content: (
        <div className="space-y-8 h-full flex flex-col justify-center">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 border-2 border-zinc-800 bg-zinc-950/80 rounded-lg relative overflow-hidden group hover:border-red-600 transition-colors duration-300 shadow-[4px_4px_0px_#111]">
              <div className="text-xs font-mono text-red-500 mb-2">PHASE 01 // MONTHS 1-3</div>
              <h4 className="text-xl font-display font-black text-white uppercase mb-4">INGESTION & GRAPH SCAFFOLD</h4>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Deploy Next.js 15 frontend shell. Setup PostgreSQL with Apache AGE. Scaffold multithreaded PDF and Gazette parser, and establish standard citation logic.
              </p>
            </div>
            <div className="p-6 border-2 border-zinc-800 bg-zinc-950/80 rounded-lg relative overflow-hidden group hover:border-red-500 transition-colors duration-300 shadow-[4px_4px_0px_#111]">
              <div className="text-xs font-mono text-red-500 mb-2">PHASE 02 // MONTHS 4-6</div>
              <h4 className="text-xl font-display font-black text-white uppercase mb-4">TIMELINE & CONTRADICTION</h4>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Build the interactive Intel Map UI. Connect pgvector semantic matching logic. Integrate automated contradiction detection engine and risk scoring models.
              </p>
            </div>
            <div className="p-6 border-2 border-zinc-800 bg-zinc-950/80 rounded-lg relative overflow-hidden group hover:border-red-600 transition-colors duration-300 shadow-[4px_4px_0px_#111]">
              <div className="text-xs font-mono text-red-500 mb-2">PHASE 03 // MONTHS 7-9</div>
              <h4 className="text-xl font-display font-black text-white uppercase mb-4">AI QA & OBSERVABILITY GATES</h4>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Deploy natural language interface for graph queries. Implement strict citation verification checks, pre-commit quality gates, and system-wide unit tests.
              </p>
            </div>
          </div>
        </div>
      )
    }
  ];

  const handleNext = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const handlePrev = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-[#0A0A0A] text-zinc-100 flex flex-col font-sans overflow-hidden">
      {/* Halftone retro pattern overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.03]" 
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.8) 1px, transparent 0)',
          backgroundSize: '10px 10px'
        }}
      />

      {/* Presentation Header */}
      <header className="relative flex items-center justify-between px-8 py-4 border-b-2 border-zinc-900 bg-black/90 z-10">
        <div className="flex items-center space-x-4">
          <span className="font-mono text-xs text-red-500 font-bold tracking-widest uppercase bg-red-950/60 border border-red-900/50 px-2 py-0.5">
            {slides[currentSlide]?.phase}
          </span>
          <span className="font-mono text-xs text-zinc-500 hidden sm:inline">// SYSTEM DECK V1.0</span>
        </div>
        <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center space-x-2 font-display text-sm uppercase tracking-widest font-black text-white italic">
          <span className="text-red-500">IIP</span> <span>POLITICAL SCOPE</span>
        </div>
        <div className="flex items-center space-x-4">
          <Link 
            href="/" 
            className="px-3 py-1 font-mono text-xs border border-zinc-800 hover:border-red-600 rounded bg-zinc-950 transition-colors duration-200"
          >
            EXIT DECK
          </Link>
        </div>
      </header>

      {/* Main Slide Stage */}
      <main className="flex-1 relative flex items-center justify-center p-8 md:p-16 overflow-y-auto">
        <div className="max-w-6xl w-full h-full flex flex-col justify-between">
          
          {/* Header Typography Group */}
          <div className="space-y-2 mb-8">
            <h2 className="text-sm font-mono text-red-500 uppercase tracking-widest font-bold">
              {slides[currentSlide]?.subtitle}
            </h2>
            <div className="h-0.5 bg-gradient-to-r from-red-600 via-zinc-800 to-transparent w-full" />
            <h3 className="text-3xl md:text-5xl font-display font-black text-white uppercase tracking-tight">
              {slides[currentSlide]?.title}
            </h3>
          </div>

          {/* Slide Content (Dynamic) */}
          <div className="flex-1 min-h-[350px] mb-8">
            {slides[currentSlide]?.content}
          </div>

          {/* Slide Progress and Actions */}
          <div className="flex items-center justify-between border-t-2 border-zinc-900 pt-6">
            <div className="flex items-center space-x-2">
              {slides.map((slide, idx) => (
                <button
                  key={slide.id}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2 transition-all duration-300 rounded ${
                    idx === currentSlide ? 'w-8 bg-red-600' : 'w-2 bg-zinc-800 hover:bg-zinc-600'
                  }`}
                />
              ))}
            </div>
            <div className="flex space-x-3">
              <button 
                onClick={handlePrev}
                className="px-4 py-2 border-2 border-zinc-800 hover:border-red-600 bg-zinc-950/80 font-mono text-xs uppercase font-bold tracking-widest text-zinc-400 hover:text-white transition-all duration-200"
              >
                PREV
              </button>
              <button 
                onClick={handleNext}
                className="px-6 py-2 border-2 border-red-600 bg-red-600 hover:bg-red-700 text-white font-mono text-xs uppercase font-bold tracking-widest transition-all duration-200 shadow-[2px_2px_0px_#111]"
              >
                NEXT
              </button>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
