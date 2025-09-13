import { FaGoogle } from "react-icons/fa";
import Button from "@/ui/react/components/Button";
import { post, ensureCsrfCookie } from "@/ui/react/api/http";
import { useMeStore } from "../state/me";

export default function LoginGoogleButton() {
  const { user, hydrated, setUser } = useMeStore();
    const loginEndpoint = import.meta.env.VITE_BACKEND_URL + "/auth/google/redirect";
    const login = () => {
        window.location.href = loginEndpoint;
    };
    const  logout =  async () => {
      await ensureCsrfCookie();
      const response = await post("/auth/logout");
      if (response.ok) {
        setUser(null);
      }
    };
    
    if (!hydrated) {
      return null; // avoid flicker until user state is hydrated
    }
    if (user && user.email) return (
      <div className="flex items-center justify-center text-black font-mono font-bold tracking-wider px-6 py-2 transition-colors">
        Logged as {user.name}. {user && <Button variant="outline" size="md" className="ml-4 cursor-pointer" onClick={logout}>Logout</Button>}
      </div>
    );
  return (
    <Button variant="outline" size="md" onClick={login} leftIcon={<FaGoogle size={18} />}>
      Login with Google
    </Button>
  );
}
