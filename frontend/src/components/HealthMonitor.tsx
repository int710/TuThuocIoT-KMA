import React, { useEffect, useState } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { Heart, Droplets, Activity, Zap, BarChart3 } from "lucide-react"; // Thêm icon BarChart3
import { api } from "../api";
import { getSocket } from "../../socket";
import type { HealthDataPoint, Sensor } from "../../types";

const HealthMonitor: React.FC = () => {
  const [data, setData] = useState<HealthDataPoint[]>([]);
  const [currentPulse, setCurrentPulse] = useState(72);
  const [currentSpo2, setCurrentSpo2] = useState(98);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const toPoint = (s: Sensor): HealthDataPoint => {
      const raw = s.timestamp || s.createdAt;
      const d = raw ? new Date(raw) : new Date();
      const timeStr = !Number.isNaN(d.getTime())
        ? d.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        : new Date().toLocaleTimeString();
      return { time: timeStr, bpm: s.heartRate, spo2: s.spo2 };
    };

    setLoading(true);
    api
      .listSensors(60)
      .then((items) => {
        if (cancelled) return;
        const points = items
          .slice()
          .reverse()
          .map((s) => toPoint(s));
        setData(points.slice(-20));
        if (items[0]) {
          setCurrentPulse(items[0].heartRate);
          setCurrentSpo2(items[0].spo2);
        }
      })
      .catch((e: any) => {
        if (!cancelled) setError("Không thể tải dữ liệu sức khỏe");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const socket = getSocket();
    const onSensor = (payload: any) => {
      const s = payload as Sensor;
      if (!s || typeof s.heartRate !== "number" || typeof s.spo2 !== "number")
        return;
      const p = toPoint(s);
      setCurrentPulse(s.heartRate);
      setCurrentSpo2(s.spo2);
      setData((prev) => [...prev, p].slice(-20));
    };
    socket.on("sensor_data", onSensor);

    return () => {
      cancelled = true;
      socket.off("sensor_data", onSensor);
    };
  }, []);

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3 text-sm font-semibold italic">
          ⚠️ {error}
        </div>
      )}

      {/* Grid thông số hiện tại */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card Nhịp tim */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-slate-500 font-medium mb-1 uppercase tracking-wider text-xs">
              Nhịp tim (BPM)
            </p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-5xl font-black text-slate-900">
                {currentPulse}
              </h3>
              <span className="text-rose-500 font-bold animate-pulse">BPM</span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-emerald-600 text-sm font-bold">
              <Zap size={16} />{" "}
              {currentPulse > 60 && currentPulse < 100
                ? "Trạng thái: Ổn định"
                : "Cần chú ý"}
            </div>
          </div>
          <div className="relative z-10 p-5 bg-rose-50 rounded-2xl text-rose-600">
            <Heart size={48} className="animate-[ping_1.5s_infinite]" />
          </div>
        </div>

        {/* Card SpO2 */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-slate-500 font-medium mb-1 uppercase tracking-wider text-xs">
              Nồng độ Oxy (SpO2)
            </p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-5xl font-black text-slate-900">
                {currentSpo2}
              </h3>
              <span className="text-blue-500 font-bold">%</span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-emerald-600 text-sm font-bold">
              <Zap size={16} />{" "}
              {currentSpo2 >= 95 ? "Trạng thái: Rất tốt" : "Cần kiểm tra"}
            </div>
          </div>
          <div className="relative z-10 p-5 bg-blue-50 rounded-2xl text-blue-600">
            <Droplets size={48} className="animate-bounce" />
          </div>
        </div>
      </div>

      {/* Grid Biểu đồ */}
      <div className="grid grid-cols-1 gap-8">
        {/* Biểu đồ Nhịp tim (BPM) */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Activity className="text-rose-600" /> Biểu đồ nhịp tim (BPM)
            </h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorBpm" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="time"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                />
                <YAxis
                  domain={[40, 120]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "16px",
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="bpm"
                  stroke="#f43f5e"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorBpm)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* BIỂU ĐỒ SPO2 MỚI THÊM */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="text-blue-600" /> Biểu đồ nồng độ Oxy (SpO2)
            </h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorSpo2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="time"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                />
                <YAxis
                  domain={[85, 100]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "16px",
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="spo2"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorSpo2)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HealthMonitor;
