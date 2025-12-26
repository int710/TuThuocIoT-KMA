import React, { useEffect, useMemo, useState } from "react";
import {
  Clock,
  CheckCircle,
  AlertCircle,
  Droplets,
  Heart,
  Thermometer,
} from "lucide-react";
import { CabinetStatus } from "../../types";
import { api } from "../api";
import { getSocket } from "../../socket";
import type { Log, Medicine, Sensor } from "../../types";

interface DashboardProps {
  cabinetStatus: CabinetStatus;
}

const Dashboard: React.FC<DashboardProps> = ({ cabinetStatus }) => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [latestSensor, setLatestSensor] = useState<Sensor | null>(null);
  const [recentLogs, setRecentLogs] = useState<Log[]>([]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([api.listMedicines(), api.listLogs(200), api.getLatestSensor()])
      .then(([meds, logs, sensor]) => {
        if (cancelled) return;
        setMedicines(meds);
        setRecentLogs(logs);
        setLatestSensor((sensor as any)?._id ? (sensor as Sensor) : null);
      })
      .catch(() => {});

    const socket = getSocket();

    const onNewLog = (log: any) => {
      setRecentLogs((prev: Log[]) => [log as Log, ...prev].slice(0, 200));
    };

    const onSensor = (sensor: any) => {
      setLatestSensor(sensor as Sensor);
    };

    const onMedicinesUpdated = () => {
      api
        .listMedicines()
        .then((meds) => setMedicines(meds))
        .catch(() => {});
    };

    socket.on("new_log", onNewLog);
    socket.on("sensor_data", onSensor);
    socket.on("medicines_updated", onMedicinesUpdated);

    return () => {
      cancelled = true;
      socket.off("new_log", onNewLog);
      socket.off("sensor_data", onSensor);
      socket.off("medicines_updated", onMedicinesUpdated);
    };
  }, []);

  const { expiringSoonCount } = useMemo(() => {
    const today = new Date();
    const expiringCount = medicines.filter((m: Medicine) => {
      if (!m.expiryDate) return false;
      const expiry = new Date(m.expiryDate);
      if (Number.isNaN(expiry.getTime())) return false;
      const diffDays =
        (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 14;
    }).length;

    return { expiringSoonCount: expiringCount };
  }, [medicines, recentLogs]);

  const reminders = useMemo(() => {
    const all: Array<{
      time: string;
      name: string;
      status: string;
      color: string;
    }> = [];
    medicines.forEach((m: Medicine) => {
      (m.reminderTimes || []).forEach((t: string) => {
        all.push({
          time: t,
          name: m.name,
          status: "pending",
          color: "bg-cyan-500",
        });
      });
    });
    return all.sort((a, b) => a.time.localeCompare(b.time)).slice(0, 5);
  }, [medicines]);

  const stats = [
    {
      label: "Thuốc trong tủ",
      value: String(medicines.length),
      icon: CheckCircle,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Thuốc sắp hết hạn",
      value: String(expiringSoonCount),
      icon: AlertCircle,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Nhịp tim gần nhất",
      value: latestSensor ? `${latestSensor.heartRate} BPM` : "--",
      icon: Heart,
      color: "text-rose-600",
      bg: "bg-rose-50",
    },
    {
      label: "SpO2 gần nhất",
      value: latestSensor ? `${latestSensor.spo2}%` : "--",
      icon: Droplets,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div
            key={idx}
            className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.bg} ${stat.color} p-3 rounded-xl`}>
                <stat.icon size={24} />
              </div>
              <span className="text-slate-400 text-xs font-medium">
                Cập nhật Realtime
              </span>
            </div>
            <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">
              {stat.value}
            </h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Next Reminders */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Clock className="text-indigo-600" size={20} />
                Lịch nhắc tiếp theo
              </h3>
              <button className="text-indigo-600 text-sm font-semibold hover:underline">
                Xem tất cả
              </button>
            </div>
            <div className="space-y-4">
              {reminders.map((reminder, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-4 p-4 rounded-xl border border-slate-50 hover:bg-slate-50 transition-colors"
                >
                  <div
                    className={`w-12 h-12 ${reminder.color} rounded-xl flex items-center justify-center text-white font-bold`}
                  >
                    {reminder.time.split(":")[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-slate-800">{reminder.name}</p>
                    <p className="text-xs text-slate-500">
                      Liều lượng: 1 viên • {reminder.time}
                    </p>
                  </div>
                  <button className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-100">
                    Chi tiết
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-cyan-500 p-8 rounded-2xl shadow-lg text-white relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-2xl font-bold mb-2">Lời khuyên từ bác sĩ</h3>
              <p className="text-indigo-100 max-w-lg">
                Dựa trên lịch sử uống thuốc của bạn, tỷ lệ tuân thủ đạt 85%. Hãy
                cố gắng uống thuốc đúng giờ, nhớ ăn no đừng để bụng đói nhé!
              </p>
              <button className="mt-6 px-6 py-3 bg-white text-indigo-600 font-bold rounded-xl shadow-sm hover:bg-cyan-50 transition-colors">
                Xem chi tiết phân tích
              </button>
            </div>
            <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>
          </div>
        </div>

        {/* Device Status */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-6">
              Trạng thái tủ
            </h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">
                  Tình trạng khóa
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    cabinetStatus.isOpen
                      ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {cabinetStatus.isOpen ? "Đang mở" : "Đã khóa"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">
                  Báo động (Buzzer)
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    cabinetStatus.buzzerOn
                      ? "bg-rose-100 text-rose-700 animate-pulse"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {cabinetStatus.buzzerOn ? "BẬT" : "TẮT"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Đèn LED</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    cabinetStatus.ledOn
                      ? "bg-cyan-100 text-indigo-700"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {cabinetStatus.ledOn ? "BẬT" : "TẮT"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">
                  Nhiệt độ bên trong
                </span>
                <div className="flex items-center gap-1 text-slate-800 font-bold">
                  <Thermometer size={16} className="text-orange-500" />
                  26.5°C
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl text-white shadow-xl">
            <h4 className="text-sm font-bold text-indigo-400 mb-2">
              Báo cáo tuần này
            </h4>
            <div className="flex items-end gap-2 h-24 mb-4">
              {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 bg-cyan-500/20 rounded-t-lg relative group"
                >
                  <div
                    style={{ height: `${h}%` }}
                    className="absolute bottom-0 w-full bg-cyan-500 rounded-t-lg transition-all group-hover:bg-cyan-400"
                  ></div>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
              <span>T2</span>
              <span>T3</span>
              <span>T4</span>
              <span>T5</span>
              <span>T6</span>
              <span>T7</span>
              <span>CN</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
