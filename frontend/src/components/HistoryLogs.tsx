import React, { useEffect, useMemo, useState } from "react";
import { Search, Download, Filter } from "lucide-react";
import { api } from "../api";
import { getSocket } from "../../socket";
import type { Log } from "../../types";

const HistoryLogs: React.FC = () => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listLogs(200);
      setLogs(data);
    } catch (e: any) {
      setError(e?.message || "Không thể tải logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    const socket = getSocket();
    const onNewLog = (log: any) => {
      setLogs((prev: Log[]) => [log as Log, ...prev].slice(0, 200));
    };
    socket.on("new_log", onNewLog);

    return () => {
      socket.off("new_log", onNewLog);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l: Log) => {
      const hay =
        `${l.action} ${l.cardUID} ${l.details} ${l.deviceID}`.toLowerCase();
      return hay.includes(q);
    });
  }, [logs, search]);

  const toDate = (l: Log) => {
    const raw = l.createdAt || l.timestamp;
    const d = raw ? new Date(raw) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
  };

  const exportCsv = () => {
    const header = [
      "createdAt",
      "deviceID",
      "cardUID",
      "action",
      "servo",
      "details",
      "success",
    ];
    const rows = filtered.map((l: Log) => [
      l.createdAt,
      l.deviceID,
      l.cardUID,
      l.action,
      l.servo,
      (l.details || "").replaceAll("\n", " "),
      String(l.success),
    ]);
    const csv = [header, ...rows]
      .map((r) =>
        r
          .map((c: unknown) => `"${String(c ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "logs.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Tìm kiếm theo action / cardUID / details..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm"
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSearch(e.target.value)
              }
            />
          </div>
          <button className="flex items-center gap-2 p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100">
            <Filter size={18} />
            <span className="hidden sm:inline text-sm font-bold">Lọc</span>
          </button>
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-bold text-sm"
        >
          <Download size={18} />
          Xuất báo cáo (CSV)
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3 text-sm font-semibold">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-widest font-bold">
                <th className="px-6 py-4">Thời gian</th>
                <th className="px-6 py-4">Hành động</th>
                <th className="px-6 py-4">Sản phẩm</th>
                <th className="px-6 py-4">Người thực hiện</th>
                <th className="px-6 py-4">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && (
                <tr>
                  <td
                    className="px-6 py-4 text-sm text-slate-500 font-semibold"
                    colSpan={5}
                  >
                    Đang tải...
                  </td>
                </tr>
              )}

              {!loading &&
                filtered.map((log: Log) => {
                  const d = toDate(log);
                  const time = d ? d.toLocaleTimeString() : "--";
                  const date = d ? d.toISOString().slice(0, 10) : "--";
                  const statusLabel = log.success ? "Thành công" : "Thất bại";

                  return (
                    <tr
                      key={log._id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-slate-800">
                          {time}
                        </div>
                        <div className="text-[10px] text-slate-400">{date}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                            log.action === "taken"
                              ? "bg-emerald-100 text-emerald-700"
                              : log.action === "missed"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-cyan-100 text-indigo-700"
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                        {log.cardUID}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {log.deviceID}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              log.success ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          ></span>
                          <span className="text-sm font-medium text-slate-700">
                            {statusLabel}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HistoryLogs;
