import { Hero } from '../components/Hero';
import { Features } from '../components/Features';
import { Pricing } from '../components/Pricing';
import { Founding } from '../components/Founding';
import { FAQ } from '../components/FAQ';
import { Download } from '../components/Download';

export function HomePage() {
  return (
    <main>
      <Hero />
      <Features />
      <Pricing />
      <Founding />
      <FAQ />
      <Download />
    </main>
  );
}
