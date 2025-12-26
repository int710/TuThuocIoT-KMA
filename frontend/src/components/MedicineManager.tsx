import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Calendar,
  Archive,
  Save,
  X,
} from "lucide-react";
import { api } from "../api";
import { getSocket } from "../../socket";
import type { Medicine } from "../../types";

const MedicineManager: React.FC = () => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    uid: "",
    closeUid: "",
    quantity: 0,
    expiryDate: "",
    servoPin: 1,
    reminderTimes: "",
    reminderTimeout: 2,
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const meds = await api.listMedicines();
      setMedicines(meds);
    } catch (e: any) {
      setError(e?.message || "Không thể tải danh sách thuốc");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    const socket = getSocket();
    const onMedicinesUpdated = () => {
      load();
    };

    const onQtyUpdated = (payload: any) => {
      const id = payload?.medicineID;
      const qty = payload?.quantity;
      if (!id || typeof qty !== "number") return;
      setMedicines((prev: Medicine[]) =>
        prev.map((m: Medicine) => (m._id === id ? { ...m, quantity: qty } : m))
      );
    };

    socket.on("medicines_updated", onMedicinesUpdated);
    socket.on("medicine_qty_updated", onQtyUpdated);

    return () => {
      socket.off("medicines_updated", onMedicinesUpdated);
      socket.off("medicine_qty_updated", onQtyUpdated);
    };
  }, []);

  const filteredMedicines = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return medicines;
    return medicines.filter(
      (m: Medicine) =>
        (m.name || "").toLowerCase().includes(q) ||
        (m.uid || "").toLowerCase().includes(q)
    );
  }, [medicines, searchTerm]);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      name: "",
      uid: "",
      closeUid: "",
      quantity: 0,
      expiryDate: "",
      servoPin: 1,
      reminderTimes: "",
      reminderTimeout: 2,
    });
    setIsFormOpen(true);
  };

  const openEdit = (m: Medicine) => {
    setEditingId(m._id);
    setForm({
      name: m.name || "",
      uid: m.uid || "",
      closeUid: m.closeUid || "",
      quantity: m.quantity ?? 0,
      expiryDate: m.expiryDate || "",
      servoPin: m.servoPin ?? 1,
      reminderTimes: (m.reminderTimes || []).join(", "),
      reminderTimeout: m.reminderTimeout ?? 2,
    });
    setIsFormOpen(true);
  };

  const submit = async () => {
    setError(null);
    try {
      const reminderTimesArr = form.reminderTimes
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean);

      const payload = {
        name: form.name,
        uid: form.uid,
        closeUid: form.closeUid,
        quantity: Number(form.quantity),
        expiryDate: form.expiryDate,
        servoPin: Number(form.servoPin),
        numReminders: reminderTimesArr.length,
        reminderTimes: reminderTimesArr,
        reminderTimeout: Number(form.reminderTimeout),
      };

      if (editingId) {
        await api.updateMedicine(editingId, payload);
      } else {
        await api.createMedicine(payload);
      }

      setIsFormOpen(false);
      setEditingId(null);
      await load();
    } catch (e: any) {
      setError(e?.message || "Không thể lưu thuốc");
    }
  };

  const remove = async (m: Medicine) => {
    const ok = confirm(`Xóa thuốc "${m.name}"?`);
    if (!ok) return;

    setError(null);
    try {
      await api.deleteMedicine(m._id);
      await load();
    } catch (e: any) {
      setError(e?.message || "Không thể xóa thuốc");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Tìm kiếm thuốc..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearchTerm(e.target.value)
            }
          />
        </div>
        <button
          onClick={openCreate}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-cyan-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-cyan-700 transition-colors shadow-lg shadow-indigo-200"
        >
          <Plus size={20} />
          Thêm thuốc mới
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3 text-sm font-semibold">
          {error}
        </div>
      )}

      {isFormOpen && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">
              {editingId ? "Cập nhật thuốc" : "Thêm thuốc"}
            </h3>
            <button
              onClick={() => setIsFormOpen(false)}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm font-semibold text-slate-600">
              Tên thuốc
              <input
                className="mt-1 w-full px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                value={form.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((p: typeof form) => ({ ...p, name: e.target.value }))
                }
              />
            </label>
            <label className="text-sm font-semibold text-slate-600">
              UID thẻ
              <input
                className="mt-1 w-full px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                value={form.uid}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((p: typeof form) => ({ ...p, uid: e.target.value }))
                }
              />
            </label>
            <label className="text-sm font-semibold text-slate-600">
              Close UID (tuỳ chọn)
              <input
                className="mt-1 w-full px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                value={form.closeUid}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((p: typeof form) => ({
                    ...p,
                    closeUid: e.target.value,
                  }))
                }
              />
            </label>
            <label className="text-sm font-semibold text-slate-600">
              Số lượng
              <input
                type="number"
                className="mt-1 w-full px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                value={form.quantity}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((p: typeof form) => ({
                    ...p,
                    quantity: Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className="text-sm font-semibold text-slate-600">
              Hạn sử dụng (YYYY-MM-DD)
              <input
                className="mt-1 w-full px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                value={form.expiryDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((p: typeof form) => ({
                    ...p,
                    expiryDate: e.target.value,
                  }))
                }
              />
            </label>
            <label className="text-sm font-semibold text-slate-600">
              Servo pin
              <input
                type="number"
                className="mt-1 w-full px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                value={form.servoPin}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((p: typeof form) => ({
                    ...p,
                    servoPin: Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className="text-sm font-semibold text-slate-600">
              Giờ nhắc (cách nhau bởi dấu phẩy)
              <input
                className="mt-1 w-full px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="08:00, 12:00"
                value={form.reminderTimes}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((p: typeof form) => ({
                    ...p,
                    reminderTimes: e.target.value,
                  }))
                }
              />
            </label>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={submit}
              className="flex items-center gap-2 bg-cyan-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-cyan-700"
            >
              <Save size={18} />
              Lưu
            </button>
            <button
              onClick={() => setIsFormOpen(false)}
              className="px-5 py-2.5 rounded-xl font-bold border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading && (
          <div className="text-slate-500 text-sm font-semibold">
            Đang tải...
          </div>
        )}

        {!loading &&
          filteredMedicines.map((med: Medicine) => (
            <div
              key={med._id}
              className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="bg-cyan-50 p-3 rounded-xl text-indigo-600">
                  <Archive size={24} />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(med)}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => remove(med)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-slate-50 rounded-lg"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <h4 className="text-xl font-bold text-slate-800 mb-1">
                {med.name}
              </h4>
              <p className="text-sm text-slate-500 mb-4 line-clamp-2">
                UID: {med.uid}
              </p>

              <div className="space-y-3 pt-4 border-t border-slate-50">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Số lượng còn:</span>
                  <span
                    className={`font-bold ${
                      med.quantity < 20 ? "text-amber-600" : "text-slate-700"
                    }`}
                  >
                    {med.quantity} viên
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Giờ uống:</span>
                  <div className="flex gap-1">
                    {(med.reminderTimes || []).map(
                      (time: string, i: number) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-semibold"
                        >
                          {time}
                        </span>
                      )
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Hạn sử dụng:</span>
                  <span className="flex items-center gap-1 text-slate-700 font-medium">
                    <Calendar size={14} />
                    {med.expiryDate}
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-50">
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      med.quantity < 10 ? "bg-red-500" : "bg-cyan-500"
                    }`}
                    style={{
                      width: `${Math.min((med.quantity / 100) * 100, 100)}%`,
                    }}
                  ></div>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 uppercase font-bold tracking-wider">
                  Mức độ tồn kho
                </p>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default MedicineManager;
