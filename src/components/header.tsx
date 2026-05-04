"use client";
import { useOnline } from "../lib/use-online";
import type { AdminUser } from "../lib/types";

export type TabId = "pos" | "sales" | "reports" | "discounts" | "payments" | "customers" | "products" | "inventory" | "eod";

interface Props {
  user: AdminUser;
  pendingCount: number;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onLogout: () => void;
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "pos", label: "POS", icon: "🛒" },
  { id: "sales", label: "Sales", icon: "📋" },
  { id: "reports", label: "Reports", icon: "📊" },
  { id: "discounts", label: "Discounts", icon: "🏷️" },
  { id: "payments", label: "Payments", icon: "💳" },
  { id: "customers", label: "Customers", icon: "👥" },
  { id: "products", label: "Products", icon: "📦" },
  { id: "inventory", label: "Inventory", icon: "📊" },
  { id: "eod", label: "EOD", icon: "📈" },
];

export default function Header({
  user,
  pendingCount,
  activeTab,
  onTabChange,
  onLogout,
}: Props) {
  const online = useOnline();

  return (
    <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-2.5 flex items-center justify-between">
      {/* Left: Brand + tabs */}
      <div className="flex items-center gap-5 flex-1 min-w-0">
        <h1 className="text-xl font-black text-white tracking-tight whitespace-nowrap">
          MARTINO NOIR <span className="text-amber-400 text-xs font-medium">POS</span>
        </h1>

        <nav className="flex gap-1 overflow-x-auto scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-300 hover:text-white hover:bg-zinc-800"
              }`}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Right: Status + User */}
      <div className="flex items-center gap-3 ml-3 flex-shrink-0">
        {/* Sync badge */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-1 bg-amber-900/40 text-amber-400 px-2.5 py-1 rounded-full text-xs font-medium">
            <span className="animate-pulse">●</span>
            {pendingCount}
          </div>
        )}

        {/* Online/Offline */}
        <div
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
            online
              ? "bg-emerald-900/40 text-emerald-400"
              : "bg-red-900/40 text-red-400"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              online ? "bg-emerald-400" : "bg-red-400 animate-pulse"
            }`}
          />
          {online ? "Online" : "Offline"}
        </div>

        {/* User */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-white text-xs font-bold">
            {user.firstName[0]}
          </div>
          <div className="hidden lg:block">
            <p className="text-white text-xs font-medium leading-tight">
              {user.firstName}
            </p>
            <p className="text-zinc-500 text-[10px] leading-tight">{user.role}</p>
          </div>
          <button
            onClick={onLogout}
            className="ml-1 text-zinc-500 hover:text-red-400 text-sm transition-colors"
            title="Logout"
          >
            ⏻
          </button>
        </div>
      </div>
    </header>
  );
}
