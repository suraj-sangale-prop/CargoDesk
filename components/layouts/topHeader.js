import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { FiMenu, FiSearch, FiBell, FiChevronDown, FiLogOut, FiSettings, FiUser } from "react-icons/fi";
import { postApiData } from "@/utilities/services/apiService";
import CommonModal from "../common/commonModal";
import ResetConfirmation from "../common/items/commonConfirmation";
import { convertFirstLetterCapital } from "@/utilities/utils";
import { useFleetDriver } from "@/context/fleetDriverContext";

export default function TopHeader({
  pageData = {},
  onToggleSidebar,
  toggleBtnRef,
  isCollapsed = false,
  isMobileOpen = false,
}) {
  const { toggleLogoutModal } = useFleetDriver() || {};
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const dropdownRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const showBrandName = isMobile ? !isMobileOpen : isCollapsed;

  const rawUserName = pageData?.user?.name || pageData?.user?.firstName || "User";
  const userName = convertFirstLetterCapital(rawUserName) || "User";
  const userInitial = userName.charAt(0).toUpperCase() || "S";

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);



  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/documents?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-18 px-4 md:px-8 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      {/* Left side: Hamburger Toggle + Smooth Brand Name + Search Bar */}
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 max-w-2xl">
        <button
          ref={toggleBtnRef}
          onClick={onToggleSidebar}
          className="p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer shrink-0"
          aria-label="Toggle Navigation"
        >
          <FiMenu className="w-5 h-5" />
        </button>

        {/* Brand Name (Smoothly slides and fades in when sidebar is closed) */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out shrink-0 flex items-center ${showBrandName
              ? "max-w-[180px] opacity-100 translate-x-0"
              : "max-w-0 opacity-0 -translate-x-3 pointer-events-none"
            }`}
          aria-hidden={!showBrandName}
        >
          <Link
            href="/"
            className="flex items-center gap-2 group select-none whitespace-nowrap pr-2"
            title="CargoDesk"
          >
            <span className="text-lg md:text-2xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 bg-clip-text text-transparent tracking-tight">
              CargoDesk
            </span>
          </Link>
        </div>

        {/* Search input field */}
        <form
          onSubmit={handleSearchSubmit}
          className="relative flex-1 max-w-md transition-all duration-300 ease-in-out"
        >
          <div className="relative">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search anything..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-100/90 hover:bg-slate-100 focus:bg-white text-slate-800 placeholder-slate-400 rounded-xl border border-transparent focus:border-blue-500/40 focus:ring-3 focus:ring-blue-500/15 transition-all outline-none"
            />
          </div>
        </form>
      </div>

      {/* Right side: Notifications & User Profile */}
      <div className="flex items-center gap-3 md:gap-5">
        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors focus:outline-none"
            aria-label="Notifications"
          >
            <FiBell className="w-5 h-5" />
            {/* Notification Badge Dot */}
            <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white animate-pulse" />
          </button>

          {/* Notifications Dropdown Preview */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-50 animate-dropdown">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="font-semibold text-sm text-slate-800">Notifications</span>
                <span className="text-xs bg-blue-50 text-blue-600 font-medium px-2 py-0.5 rounded-full">
                  1 New
                </span>
              </div>
              <div className="py-3 text-xs text-slate-600 space-y-2">
                <div className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-colors">
                  <p className="font-medium text-slate-800">Vehicle PUC Expiry Alert</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">MH 03 CD 5678 PUC expires soon.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2.5 p-1.5 pr-2.5 hover:bg-slate-100/80 rounded-xl transition-all focus:outline-none group"
          >
            {/* Purple Avatar with Initial */}
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm shadow-purple-500/20 group-hover:scale-105 transition-transform">
              {userInitial}
            </div>
            <span className="hidden sm:inline-block text-sm font-semibold text-slate-800">
              {userName}
            </span>
            <FiChevronDown className={`w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""
              }`} />
          </button>

          {/* Profile Dropdown */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-dropdown">
              <div className="px-4 py-2.5 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-900">{userName}</p>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  {pageData?.user?.email || "admin@cargodesk.com"}
                </p>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    router.push("/settings");
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <FiSettings className="w-4 h-4 text-slate-400" />
                  Account Settings
                </button>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    toggleLogoutModal();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50/70 transition-colors"
                >
                  <FiLogOut className="w-4 h-4 text-rose-500" />
                  Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>


    </header>
  );
}
