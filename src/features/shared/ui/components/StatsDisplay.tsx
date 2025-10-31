import { FPSCounter, PingDisplay } from "@/features/game/ui";

interface StatsDisplayProps {
  hudScale?: number;
}

export default function StatsDisplay({ hudScale = 100 }: StatsDisplayProps) {
  const scaleValue = hudScale / 100;

  return (
    <div 
      className="fixed top-4 right-4 z-50 flex gap-3"
      style={{ transform: `scale(${scaleValue})`, transformOrigin: 'top right' }}
    >
      <PingDisplay />
      <FPSCounter />
    </div>
  );
}
