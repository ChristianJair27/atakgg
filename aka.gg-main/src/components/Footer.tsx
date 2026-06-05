import { GamepadIcon } from 'lucide-react';
import atakLogo from '../../public/atak-logo.png';

export const Footer = () => {
  return (
    <footer className="border-t border-border bg-background/50 backdrop-blur-sm mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <img
              src={atakLogo}
              alt="ATAK.GG Logo"
              className="h-8 w-auto transition-transform group-hover:scale-105"
            />
            <span className="text-lg font-bold bg-gradient-primary bg-clip-text text-transparent">
              ATAK.GG
            </span>
          </div>
          
          <div className="flex items-center space-x-6 text-sm text-muted-foreground">
            <span>© 2026 ATAKGG. Design by Revolution505</span>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-border text-center text-xs text-muted-foreground">
          <p>ATAK.GG no está afiliado con Riot Games. League of Legends es una marca comercial de Riot Games, Inc.</p>
        </div>
      </div>
    </footer>
  );
};