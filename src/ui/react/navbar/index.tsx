import LoginGoogleButton from "./LoginGoogleButton";

export default function Navbar() {
  return (
    <div className="fixed top-1 left-4 h-16  flex items-center z-10">
      <LoginGoogleButton />
    </div>
  )
}