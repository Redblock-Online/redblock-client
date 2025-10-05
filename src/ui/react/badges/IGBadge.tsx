import { useEffect, useState } from "react";
import { FaInstagram } from "react-icons/fa";
import Button from "../components/Button";

interface IGBadgeProps {
  started: boolean;
}

export default function IGBadge({ started }: IGBadgeProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (started) {
      const timer = setTimeout(() => {
        setVisible(false);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setVisible(true);
    }
  }, [started]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        setVisible((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <a 
      href="https://instagram.com/redblock.online" 
      target="_blank" 
      rel="noreferrer"
      className={`transition-opacity duration-1000 ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <Button leftIcon={<FaInstagram size={28} />} variant="outline" size="sm" className="fixed top-3 right-3 z-20">
        <span>@redblock.online</span>
      </Button>
    </a>
  );
}
