"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link href={user ? `/${user.role}` : "/login"} className="logo">
          <span className="logo-mark">M</span> Meme&apos;d <span className="logo-sub">Payout Tracker</span>
        </Link>
        {user && (
          <div className="nav-right">
            <span className="chip chip-role">{user.role}</span>
            <span className="nav-name">{user.name}</span>
            <button className="btn btn-ghost" onClick={() => { logout(); router.push("/login"); }}>Log out</button>
          </div>
        )}
      </div>
    </header>
  );
}
