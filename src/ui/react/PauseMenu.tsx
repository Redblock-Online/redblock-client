import Button from "@/ui/react/components/Button";
import { useCountdown } from "@/ui/react/hooks/useCountdown";

type Props = {
  visible: boolean;
  onContinue: () => void;
  onExit: () => void;
};

export default function PauseMenu({ visible, onContinue, onExit }: Props) {
  const countdown = useCountdown(visible, 3);

  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center text-black">
      {/* background grid overlay */}
      <div className="absolute inset-0 bg-white/90" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_49%,#000_49%,#000_51%,transparent_51%),linear-gradient(0deg,transparent_49%,#000_49%,#000_51%,transparent_51%)] [background-size:80px_80px] opacity-10" />

      <div className="relative z-30 flex flex-col gap-6 items-center p-8 border-[3px] border-black bg-white/95">
        <h2 className="font-mono text-2xl font-bold tracking-wider">Paused</h2>
        <div className="flex flex-col gap-4 items-center">
          <Button disabled={countdown > 0} size="lg" variant="primary" onClick={onContinue}>
            CONTINUE {countdown > 0 ? `(${countdown})` : ""}
          </Button>
          <Button size="lg" variant="outline" onClick={onExit}>
            EXIT TO MENU
          </Button>
        </div>
      </div>
    </div>
  );
}
