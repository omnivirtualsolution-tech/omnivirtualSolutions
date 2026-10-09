import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Hero from '../components/Hero';
import About from '../components/About';
import ServicesSection from '../components/ServicesSection';
import CallToAction from '../components/CallToAction';
import Contact from '../components/Contact';

export default function Home() {
  const location = useLocation();

  useEffect(() => {
    document.title = 'Omni Virtual Solutions — Empowering Individuals & Businesses';
  }, []);

  useEffect(() => {
    if (location.hash) {
      const element = document.querySelector(location.hash);
      if (element) {
        setTimeout(() => {
          const header = document.querySelector('#header');
          const offset = header ? header.offsetHeight : 70;
          const top = element.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        }, 150);
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, [location]);

  return (
    <main className="main">
      <Hero />
      <About />
      <ServicesSection />
      <CallToAction />
      <Contact />
    </main>
  );
}
