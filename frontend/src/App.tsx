import React, { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  Pill,
  IdCard,
  Activity,
  Terminal,
  History,
  Settings,
  LogOut,
  Bell,
  User as UserIcon,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import Dashboard from "./components/Dashboard";
import MedicineManager from "./components/MedicineManager";
import RFIDManager from "./components/RFIDManager";
import HealthMonitor from "./components/HealthMonitor";
import Console from "./components/Console";
import HistoryLogs from "./components/HistoryLogs";
import SettingsPanel from "./components/SettingsPanel";
import Login from "./components/Login";
import { User, CabinetStatus } from "../types";
import { api } from "./api";
import { getSocket } from "../socket";

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [cabinetStatus, setCabinetStatus] = useState<CabinetStatus>({
    isOpen: false,
    ledOn: false,
    buzzerOn: false,
    manualOverride: true,
    lastSync: new Date().toISOString(),
  });

  const mapAnyStatusToCabinetStatus = useCallback(
    (payload: any): CabinetStatus => {
      const now = new Date().toISOString();
      const lockOutside = payload?.config?.lockRFIDOutsideReminder;
      const manual =
        payload?.manualOverride ?? payload?.manual ?? payload?.allowManual;

      return {
        isOpen: Boolean(
          payload?.isOpen ??
            payload?.doorOpen ??
            payload?.open ??
            cabinetStatus.isOpen
        ),
        ledOn: Boolean(
          payload?.ledOn ??
            payload?.led ??
            payload?.light ??
            cabinetStatus.ledOn
        ),
        buzzerOn: Boolean(
          payload?.buzzerOn ??
            payload?.buzzer ??
            payload?.alarm ??
            cabinetStatus.buzzerOn
        ),
        manualOverride:
          typeof manual === "boolean"
            ? manual
            : typeof lockOutside === "boolean"
            ? !lockOutside
            : cabinetStatus.manualOverride,
        lastSync: payload?.lastSync ?? now,
      };
    },
    [
      cabinetStatus.buzzerOn,
      cabinetStatus.isOpen,
      cabinetStatus.ledOn,
      cabinetStatus.manualOverride,
    ]
  );

  useEffect(() => {
    let cancelled = false;

    api
      .getStatus()
      .then((status) => {
        if (cancelled) return;
        setCabinetStatus(mapAnyStatusToCabinetStatus(status));
      })
      .catch(() => {});

    const socket = getSocket();

    const onInitialStatus = (status: any) => {
      setCabinetStatus((prev: CabinetStatus) => ({
        ...prev,
        ...mapAnyStatusToCabinetStatus(status),
      }));
    };

    const onStatusUpdate = (status: any) => {
      setCabinetStatus((prev: CabinetStatus) => ({
        ...prev,
        ...mapAnyStatusToCabinetStatus(status),
      }));
    };

    socket.on("initial_status", onInitialStatus);
    socket.on("status_update", onStatusUpdate);

    return () => {
      cancelled = true;
      socket.off("initial_status", onInitialStatus);
      socket.off("status_update", onStatusUpdate);
    };
  }, [mapAnyStatusToCabinetStatus]);

  const handleLogin = (u: User) => {
    setUser(u);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUser(null);
    setActiveTab("dashboard");
  };

  const menuItems = [
    { id: "dashboard", label: "Tổng quan", icon: LayoutDashboard },
    { id: "medicines", label: "Quản lý thuốc", icon: Pill },
    { id: "rfid", label: "Thẻ RFID", icon: IdCard },
    { id: "health", label: "Sức khỏe", icon: Activity },
    { id: "console", label: "Điều khiển", icon: Terminal },
    { id: "history", label: "Lịch sử", icon: History },
    { id: "settings", label: "Cài đặt", icon: Settings },
  ];

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="bg-cyan-600 p-2 rounded-xl text-white">
              <Pill size={24} />
            </div>
            <h1 className="text-xl font-bold text-slate-800">Tủ Thuốc Smart</h1>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id
                  ? "bg-cyan-50 text-indigo-700 font-semibold"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl mb-3">
            <img
              src={
                user?.picture ||
                "https://actvn.edu.vn/Images/actvn_big_icon.png"
              }
              className="w-10 h-10 rounded-full border-2 border-white"
              alt="avatar"
            />
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold text-slate-800 truncate">
                {user?.name}
              </p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-slate-500 hover:text-red-600 transition-colors"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white transform transition-transform md:hidden ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 flex items-center justify-between border-b">
          <div className="flex items-center gap-3">
            <Pill className="text-indigo-600" />
            <span className="font-bold text-slate-800">SmartMedi</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)}>
            <X size={24} />
          </button>
        </div>
        <nav className="p-4 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${
                activeTab === item.id
                  ? "bg-cyan-50 text-indigo-700"
                  : "text-slate-500"
              }`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
            <h2 className="text-lg font-bold text-slate-800 capitalize">
              {menuItems.find((item) => item.id === activeTab)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold animate-pulse">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              ESP32 Online
            </div>
            <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-cyan-50 rounded-full transition-all">
              <Bell size={20} />
            </button>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto p-6 scroll-smooth">
          {activeTab === "dashboard" && (
            <Dashboard cabinetStatus={cabinetStatus} />
          )}
          {activeTab === "medicines" && <MedicineManager />}
          {activeTab === "rfid" && <RFIDManager />}
          {activeTab === "health" && <HealthMonitor />}
          {activeTab === "console" && (
            <Console status={cabinetStatus} setStatus={setCabinetStatus} />
          )}
          {activeTab === "history" && <HistoryLogs />}
          {activeTab === "settings" && <SettingsPanel user={user} />}
        </section>
      </main>
    </div>
  );
};

export default App;
