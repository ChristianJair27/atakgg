// src/components/PillNav.tsx
import React, { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { gsap } from 'gsap';

import atakLogo from '../../public/atak-logo.png'; // Ajusta la ruta si es necesario

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Stats', href: '/stats' },
  { label: 'Tournaments', href: '/tournaments' },
  { label: 'Social', href: '/social' },
];

const PillNav = () => {
  const location = useLocation();
  const activeHref = location.pathname;

  const pillRefs = useRef<(HTMLDivElement | null)[]>([]);
  const circleRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const layout = () => {
      pillRefs.current.forEach((pill, i) => {
        const circle = circleRefs.current[i];
        if (!pill || !circle) return;

        const { width: w, height: h } = pill.getBoundingClientRect();
        const radius = Math.sqrt((w / 2) ** 2 + h ** 2);
        const diameter = 2 * radius + 8;

        circle.style.width = `${diameter}px`;
        circle.style.height = `${diameter}px`;
        circle.style.left = '50%';
        circle.style.bottom = '0';
        circle.style.transform = 'translateX(-50%) scale(0)';
        circle.style.transformOrigin = 'center bottom';
      });
    };

    layout();
    window.addEventListener('resize', layout);
    return () => window.removeEventListener('resize', layout);
  }, []);

  const handleEnter = (i: number) => {
    const circle = circleRefs.current[i];
    if (circle) {
      gsap.to(circle, { scale: 1.1, duration: 0.6, ease: 'power3.out' });
    }
  };

  const handleLeave = (i: number) => {
    const circle = circleRefs.current[i];
    if (circle) {
      gsap.to(circle, { scale: 0, duration: 0.4, ease: 'power3.out' });
    }
  };

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center bg-black/80 backdrop-blur-xl rounded-full border border-red-800/50 shadow-2xl px-6 py-3">
      {/* Logo */}
      <Link to="/" className="mr-8">
        <img src={atakLogo} alt="ATAK.GG" className="h-10 w-10 object-contain hover:rotate-12 transition-transform duration-300" />
      </Link>

      {/* Navigation Pills */}
      <div className="hidden md:flex items-center gap-2">
        {navItems.map((item, i) => {
          const isActive = activeHref === item.href;

          return (
            <div
              key={item.href}
              ref={el => (pillRefs.current[i] = el)}
              className="relative overflow-hidden rounded-full"
              onMouseEnter={() => handleEnter(i)}
              onMouseLeave={() => handleLeave(i)}
            >
              <Link
                to={item.href}
                className={`relative z-10 block px-6 py-3 text-sm font-medium uppercase tracking-wider transition-colors ${
                  isActive ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {item.label}
              </Link>

              {/* Circle hover effect */}
              <span
                ref={el => (circleRefs.current[i] = el)}
                className="absolute inset-0 rounded-full bg-red-500/30 pointer-events-none"
              />

              {/* Active indicator */}
              {isActive && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </div>
          );
        })}
      </div>

      {/* Auth Buttons */}
      <div className="ml-auto flex items-center gap-4">
        <Link to="/login">
          <button className="px-5 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors">
            Login
          </button>
        </Link>
        <Link to="/register">
          <button className="px-6 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-full transition-colors">
            Register
          </button>
        </Link>
      </div>
    </nav>
  );
};

export default PillNav;