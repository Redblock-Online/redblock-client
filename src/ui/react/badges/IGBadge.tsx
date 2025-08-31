import { FaInstagram } from "react-icons/fa";
import Button from "../components/Button";


export default function IGBadge() {
  return (
    <Button leftIcon={<FaInstagram size={28} />} variant="outline" size="sm" className="fixed  top-3 right-3 z-20">
      <span>@redblock.online</span>
    </Button>
  );
}
