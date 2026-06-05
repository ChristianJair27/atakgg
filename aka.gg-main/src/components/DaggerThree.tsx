import { useEffect, useRef } from 'react';
import { createDaggerViewer } from '../three/dagger-viewer';

export default function DaggerThree() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const daggerUrl = `${import.meta.env.BASE_URL}models/dagger.glb`;

  useEffect(() => {
    if (!ref.current) return;
    
    const viewer = createDaggerViewer({
      canvas: ref.current,
      modelUrl: daggerUrl,
    });
    
    return () => viewer.destroy();
  }, [daggerUrl]);

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden">
      <canvas 
        ref={ref} 
        className="w-full h-full" 
      />
      {/* Overlay informativo */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0A1428]/90 to-transparent">
        <h3 className="text-[#C8AA6E] font-bold text-lg">Daga de los Invocadores</h3>
        <p className="text-[#A09B8C] text-sm">Explora este emblemático objeto</p>
      </div>
    </div>
  );
}