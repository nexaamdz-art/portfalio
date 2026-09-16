/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import ModelViewer3D from './components/ModelViewer3D';
import ProjectsSection from './components/ProjectsSection';

export default function App() {
  return (
    <main
      id="main-content"
      className="w-full min-h-screen bg-[#0b0416] selection:bg-purple-600/30 selection:text-white"
    >
      {/* 1. Home Section */}
      <section
        id="home"
        aria-label="Home"
        className="w-full min-h-screen flex items-center justify-between px-6 sm:px-10 lg:px-12 xl:px-16 relative overflow-hidden"
      >
        {/* Subtle cinematic ambient glow on the left */}
        <div
          id="hero-ambient-glow"
          aria-hidden="true"
          className="absolute -left-24 top-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"
        />

        {/* Content container: text aligned to far left, 3D model to far right */}
        <div
          id="hero-content-wrapper"
          className="w-full flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12 py-8 lg:py-12 z-10"
        >
          {/* Text Group: positioned at the far left, vertically centered */}
          <motion.div
            id="hero-text-container"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            dir="ltr"
            className="w-full lg:w-auto lg:max-w-md xl:max-w-lg flex flex-col items-start text-left z-10 select-none shrink-0 -mt-10 sm:-mt-14 lg:-mt-20"
          >
            {/* Greeting: Luxurious serif */}
            <motion.h2
              id="hero-greeting"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              style={{ fontSize: '43px', lineHeight: '57px' }}
              className="font-serif-luxury font-light tracking-wide text-white glow-blue-subtle mb-1 sm:mb-2"
            >
              Hi, I’m
            </motion.h2>

            {/* Name: Hand-drawn cursive script, largest element by far */}
            <motion.h1
              id="hero-name"
              initial={{ opacity: 0, y: 45 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.1, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
              style={{ lineHeight: '129.8px' }}
              className="font-script text-7xl sm:text-8xl md:text-9xl lg:text-[10rem] font-normal text-white glow-blue-soft tracking-tight -ml-1 sm:-ml-2 mb-6 sm:mb-8"
            >
              Alycia
            </motion.h1>

            {/* Role: Modern clean sans-serif */}
            <motion.p
              id="hero-title"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="font-sans-modern text-sm sm:text-base md:text-lg font-medium text-slate-100/90 tracking-wider uppercase glow-blue-subtle mb-4 sm:mb-5"
            >
              Creative Developer &amp; UI/UX Designer
            </motion.p>

            {/* Description: Elegant delicate serif */}
            <motion.p
              id="hero-description"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="font-serif-luxury text-base sm:text-lg md:text-xl font-light italic text-slate-300/85 leading-relaxed glow-blue-faint max-w-xs sm:max-w-sm"
            >
              I turn ideas into immersive
              <br />
              digital experiences.
            </motion.p>
          </motion.div>

          {/* 3D Model Section: positioned at the far right */}
          <motion.div
            id="hero-3d-section"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="w-full lg:flex-1 flex items-center justify-center lg:justify-end"
          >
            <ModelViewer3D modelUrl="/models/hijabgirl.glb" />
          </motion.div>
        </div>
      </section>

      {/* 2. About Me Section */}
      <section
        id="about-me"
        aria-label="About Me"
        className="w-full min-h-screen"
      />

      {/* 3. Services Section */}
      <section
        id="services"
        aria-label="Services"
        className="w-full min-h-screen"
      />

      {/* 4. Projects Section */}
      <ProjectsSection />

      {/* 5. Contact Section */}
      <section
        id="contact"
        aria-label="Contact"
        className="w-full min-h-screen"
      />
    </main>
  );
}

