import React, { useEffect, useState } from "react";
import {
  Bell,
  Shield,
  Smartphone,
  Bot,
  ExternalLink,
  Mail,
  User as UserIcon,
} from "lucide-react";
import { api } from "../api";
import { getSocket } from "../../socket";
import type { Config, Recipient, User } from "../../types";

interface SettingsPanelProps {
  user: User | null;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ user }) => {
  const [config, setConfig] = useState<Config | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [chatIdInput, setChatIdInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const [cfg, recs] = await Promise.all([
        api.getConfig(),
        api.listRecipients(),
      ]);
      setConfig(cfg);
      setRecipients(recs);
    } catch (e: any) {
      setError(e?.message || "Không thể tải cài đặt");
    }
  };

  const ensureConfig = (c: Config | null): Config =>
    c || {
      servoTimeout: 10000,
      lockRFIDOutsideReminder: false,
      wifiSSID: "",
      wifiPassword: "",
      updatedAt: new Date().toISOString(),
    };

  useEffect(() => {
    load();

    const socket = getSocket();
    const onConfigUpdated = (cfg: any) => {
      setConfig(cfg as Config);
    };
    const onRecipientsUpdated = () => {
      api
        .listRecipients()
        .then((recs) => setRecipients(recs))
        .catch(() => {});
    };

    socket.on("config_updated", onConfigUpdated);
    socket.on("recipients_updated", onRecipientsUpdated);
    return () => {
      socket.off("config_updated", onConfigUpdated);
      socket.off("recipients_updated", onRecipientsUpdated);
    };
  }, []);

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      const next = await api.updateConfig({
        servoTimeout: Number(config.servoTimeout),
        lockRFIDOutsideReminder: Boolean(config.lockRFIDOutsideReminder),
        wifiSSID: config.wifiSSID,
        wifiPassword: config.wifiPassword,
      });
      setConfig(next);
    } catch (e: any) {
      setError(e?.message || "Không thể lưu cấu hình");
    } finally {
      setSaving(false);
    }
  };

  const addRecipient = async () => {
    const val = Number(chatIdInput);
    if (!Number.isFinite(val) || !val) return;
    setError(null);
    try {
      await api.createRecipient(val);
      setChatIdInput("");
      await load();
    } catch (e: any) {
      setError(e?.message || "Không thể thêm Chat ID");
    }
  };

  const deleteRecipient = async (id: string) => {
    const ok = confirm("Xóa Chat ID này?");
    if (!ok) return;
    setError(null);
    try {
      await api.deleteRecipient(id);
      await load();
    } catch (e: any) {
      setError(e?.message || "Không thể xóa Chat ID");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3 text-sm font-semibold">
          {error}
        </div>
      )}

      {/* Profile Section */}
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <UserIcon size={24} className="text-indigo-600" />
          Thông tin cá nhân
        </h3>
        <div className="flex flex-col sm:flex-row items-center gap-8">
          <div className="relative group">
            <img
              src={user?.picture || "https://picsum.photos/120/120"}
              className="w-24 h-24 rounded-3xl shadow-lg group-hover:opacity-90 transition-opacity"
              alt="profile"
            />
            <button className="absolute bottom-0 right-0 p-2 bg-cyan-600 text-white rounded-xl shadow-lg hover:scale-110 transition-transform">
              <Shield size={16} />
            </button>
          </div>
          <div className="flex-1 text-center sm:text-left space-y-2">
            <h4 className="text-2xl font-black text-slate-900">{user?.name}</h4>
            <p className="text-slate-500 flex items-center justify-center sm:justify-start gap-2">
              <Mail size={16} />
              {user?.email}
            </p>
            <div className="pt-2 flex flex-wrap justify-center sm:justify-start gap-2">
              <span className="px-3 py-1 bg-cyan-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider rounded-lg">
                Premium User
              </span>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded-lg">
                Verified Account
              </span>
            </div>
          </div>
          <button className="px-6 py-2 border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors">
            Chỉnh sửa
          </button>
        </div>
      </div>

      {/* Integrations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Bot className="text-sky-500" size={24} />
              Telegram Bot
            </h3>
            <button className="text-sky-500">
              <ExternalLink size={20} />
            </button>
          </div>
          <p className="text-sm text-slate-500">
            Đăng ký nhận thông báo nhắc nhở và cảnh báo bỏ thuốc trực tiếp qua
            Telegram.
          </p>
          <div className="space-y-3">
            <div className="flex gap-3">
              <input
                value={chatIdInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setChatIdInput(e.target.value)
                }
                placeholder="Nhập Chat ID"
                className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
              <button
                onClick={addRecipient}
                className="px-4 py-2 bg-sky-500 text-white text-xs font-bold rounded-xl hover:bg-sky-600 transition-colors"
              >
                Thêm
              </button>
            </div>
            <div className="space-y-2">
              {recipients.map((r: Recipient) => (
                <div
                  key={r._id}
                  className="p-4 bg-sky-50 border border-sky-100 rounded-2xl flex items-center justify-between"
                >
                  <div className="text-xs font-bold text-sky-800">
                    Chat ID: {r.chatID}
                  </div>
                  <button
                    onClick={() => deleteRecipient(r._id)}
                    className="px-4 py-1.5 bg-white border border-sky-200 text-sky-700 text-xs font-bold rounded-lg hover:bg-sky-100 transition-colors"
                  >
                    Xóa
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Smartphone className="text-emerald-500" size={24} />
              Blynk IoT
            </h3>
            <button className="text-emerald-500">
              <ExternalLink size={20} />
            </button>
          </div>
          <p className="text-sm text-slate-500">
            Cho phép điều khiển tủ và nhận push notifications qua ứng dụng Blynk
            trên điện thoại.
          </p>
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between">
            <div className="text-xs font-bold text-emerald-800">
              Token: BK_882...X12
            </div>
            <button className="px-4 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600 transition-colors">
              Làm mới
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Bell className="text-amber-500" size={24} />
          Thông báo hệ thống
        </h3>
        <div className="space-y-4">
          {[
            {
              label: "Nhắc uống thuốc",
              desc: "Gửi thông báo khi đến giờ uống thuốc theo lịch.",
              default: true,
            },
            {
              label: "Cảnh báo bỏ liều",
              desc: "Cảnh báo nếu tủ chưa mở sau 5 phút kể từ giờ hẹn.",
              default: true,
            },
            {
              label: "Cập nhật hệ thống",
              desc: "Thông báo về các bản cập nhật firmware ESP32.",
              default: false,
            },
          ].map((n, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-4 rounded-2xl border border-slate-50 hover:bg-slate-50 transition-colors"
            >
              <div>
                <h5 className="font-bold text-slate-800 text-sm">{n.label}</h5>
                <p className="text-xs text-slate-400">{n.desc}</p>
              </div>
              <div className="w-12 h-6 bg-cyan-600 rounded-full relative">
                <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Shield className="text-indigo-600" size={24} />
          Cấu hình hệ thống
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm font-semibold text-slate-600">
            Servo Timeout (ms)
            <input
              type="number"
              value={config?.servoTimeout ?? 10000}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setConfig((p: Config | null) => ({
                  ...ensureConfig(p),
                  servoTimeout: Number(e.target.value),
                }))
              }
              className="mt-1 w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </label>

          <label className="text-sm font-semibold text-slate-600">
            Khóa RFID ngoài giờ nhắc
            <div className="mt-2 flex items-center gap-3">
              <input
                type="checkbox"
                checked={Boolean(config?.lockRFIDOutsideReminder)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setConfig((p: Config | null) => ({
                    ...ensureConfig(p),
                    lockRFIDOutsideReminder: e.target.checked,
                  }))
                }
                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-700 font-semibold">
                {Boolean(config?.lockRFIDOutsideReminder) ? "Bật" : "Tắt"}
              </span>
            </div>
          </label>

          <label className="text-sm font-semibold text-slate-600">
            WiFi SSID
            <input
              value={config?.wifiSSID ?? ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setConfig((p: Config | null) => ({
                  ...ensureConfig(p),
                  wifiSSID: e.target.value,
                }))
              }
              className="mt-1 w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </label>

          <label className="text-sm font-semibold text-slate-600">
            WiFi Password
            <input
              value={config?.wifiPassword ?? ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setConfig((p: Config | null) => ({
                  ...ensureConfig(p),
                  wifiPassword: e.target.value,
                }))
              }
              className="mt-1 w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </label>
        </div>

        <div className="mt-6">
          <button
            onClick={saveConfig}
            disabled={!config || saving}
            className="px-6 py-2 bg-cyan-600 text-white rounded-xl font-bold text-sm hover:bg-cyan-700 disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : "Lưu cấu hình"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
