import React, { useState, useEffect, useRef } from "react";
import {
  Power,
  Lock,
  Unlock,
  Volume2,
  Lightbulb,
  Terminal as TerminalIcon,
  Send,
  RefreshCw,
  Activity,
} from "lucide-react";
import { api } from "../api";
import { CabinetStatus } from "../../types";

interface ConsoleProps {
  status: CabinetStatus;
  setStatus: React.Dispatch<React.SetStateAction<CabinetStatus>>;
}

const Console: React.FC<ConsoleProps> = ({ status, setStatus }) => {
  const [logs, setLogs] = useState<string[]>([
    "[SYSTEM] Khởi động hệ thống thành công...",
    "[WIFI] Đã kết nối với địa chỉ 192.168.1.15",
    "[MQTT] Connected to broker successfully.",
    "[SERVER] Socket.IO connection established.",
  ]);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const history = await api.listLogs(10);
      } catch (err) {
        console.error("Không thể lấy nhật ký", err);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const toggleStatus = (key: keyof CabinetStatus, label: string) => {
    setStatus((prev) => {
      const newVal = !prev[key];
      addLog(`Lệnh: Tắt/Mở ${label} -> ${newVal ? "BẬT" : "TẮT"}`);
      return { ...prev, [key]: newVal };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = inputValue.toLowerCase().trim();
    if (!cmd || loading) return;

    addLog(`USER COMMAND: ${cmd}`);

    if (cmd === "open") handleControl("open", "Mở tủ");
    else if (cmd === "close") handleControl("close", "Đóng tủ");
    else if (cmd === "led on") handleControl("led_on", "Bật LED");
    else if (cmd === "led off") handleControl("led_off", "Tắt LED");
    else if (cmd === "buzzer on") handleControl("buzzer_on", "Bật Còi");
    else if (cmd === "buzzer off") handleControl("buzzer_off", "Tắt Còi");
    else if (cmd === "help")
      addLog("Lệnh: open, close, led on/off, buzzer on/off, clear");
    else if (cmd === "clear") setLogs([]);
    else addLog(`? Lệnh không xác định: ${cmd}`);

    setInputValue("");
  };

  const handleControl = async (action: string, label: string) => {
    if (loading) return;
    setLoading(true);
    addLog(`COMMAND: Gửi lệnh ${label}...`);
    try {
      const response = await api.control(action);
      addLog(`SUCCESS: Server phản hồi: ${response.message || "Đã thực thi"}`);
    } catch (err: any) {
      addLog(`ERROR: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (action: string, label: string) => {
    if (loading) return;
    setLoading(true);
    addLog(`ĐANG GỬI: Lệnh ${label}...`);

    try {
      await api.control(action);
      addLog(`THÀNH CÔNG: Server xác nhận ${label}`);
    } catch (err: any) {
      addLog(`LỖI: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 h-full">
      <div className="xl:col-span-1 space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Power className="text-indigo-600" size={20} />
            Điều khiển nhanh
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3">
                {status.isOpen ? (
                  <Unlock className="text-amber-500" size={20} />
                ) : (
                  <Lock className="text-slate-400" size={20} />
                )}
                <span className="font-bold text-slate-700">Khóa tủ</span>
              </div>
              <button
                disabled={loading}
                onClick={() =>
                  handleToggle(
                    status.isOpen ? "close" : "open",
                    status.isOpen ? "Đóng tủ" : "Mở tủ"
                  )
                }
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  status.isOpen ? "bg-amber-400" : "bg-slate-300"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                    status.isOpen ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3">
                <Lightbulb
                  className={status.ledOn ? "text-cyan-500" : "text-slate-400"}
                  size={20}
                />
                <span className="font-bold text-slate-700">Đèn LED</span>
              </div>
              <button
                disabled={loading}
                onClick={() =>
                  handleToggle(
                    status.ledOn ? "led_off" : "led_on",
                    status.ledOn ? "Tắt LED" : "Bật LED"
                  )
                }
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  status.ledOn ? "bg-cyan-400" : "bg-slate-300"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                    status.ledOn ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3">
                <Volume2
                  className={
                    status.buzzerOn ? "text-rose-500" : "text-slate-400"
                  }
                  size={20}
                />
                <span className="font-bold text-slate-700">Còi báo</span>
              </div>
              <button
                disabled={loading}
                onClick={() =>
                  handleToggle(
                    status.buzzerOn ? "buzzer_off" : "buzzer_on",
                    status.buzzerOn ? "Tắt Còi" : "Bật Còi"
                  )
                }
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  status.buzzerOn ? "bg-rose-400" : "bg-slate-300"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                    status.buzzerOn ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={status.manualOverride}
                  onChange={() =>
                    toggleStatus("manualOverride", "Chế độ mở thủ công")
                  }
                />
                <span className="text-sm font-semibold text-slate-600 group-hover:text-slate-800 transition-colors">
                  Cho phép mở ngoài giờ nhắc
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="xl:col-span-3 h-[600px] flex flex-col bg-slate-950 rounded-2xl shadow-2xl border border-slate-800 relative overflow-hidden">
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TerminalIcon size={16} className="text-emerald-400" />
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">
              System Monitor Console v2.4
            </span>
          </div>
          <button
            onClick={() => setLogs([])}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 p-6 overflow-y-auto font-mono text-sm space-y-2 custom-scrollbar"
        >
          {logs.map((log, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-emerald-500/50 shrink-0 select-none">
                ❯
              </span>
              <span
                className={
                  log.includes("[SYSTEM]")
                    ? "text-indigo-400"
                    : log.includes("COMMAND")
                    ? "text-amber-400 font-bold"
                    : "text-slate-300"
                }
              >
                {log}
              </span>
            </div>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-4 bg-slate-900 border-t border-slate-800 flex gap-4"
        >
          <input
            type="text"
            placeholder="Nhập lệnh điều khiển (vd: open, led on, buzzer off)..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-300 text-sm font-mono focus:outline-none focus:border-emerald-500/50 transition-colors"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-lg transition-colors"
          >
            <Send size={18} />
          </button>
        </form>

        <div className="absolute top-24 right-6 pointer-events-none opacity-5">
          <Activity size={300} strokeWidth={1} />
        </div>
      </div>
    </div>
  );
};

export default Console;
