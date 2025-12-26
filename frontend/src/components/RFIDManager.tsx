import React, { useEffect, useMemo, useState } from "react";
import {
  IdCard,
  Plus,
  Link,
  Unlink,
  Activity,
  AlertCircle,
} from "lucide-react";
import { api } from "../api";
import { getSocket } from "../../socket";
import type { Medicine, RFIDCard } from "../../types";

const RFIDManager: React.FC = () => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [scannedUid, setScannedUid] = useState("");
  const [selectedMedicineId, setSelectedMedicineId] = useState("");
  const [targetField, setTargetField] = useState<"uid" | "closeUid">("uid");

  const cards = useMemo(() => {
    const list: RFIDCard[] = [];
    medicines.forEach((m: Medicine) => {
      if (m.uid) {
        list.push({
          id: `${m._id}:uid`,
          uid: m.uid,
          medicineId: m._id,
          medicineName: m.name,
        });
      }
      if (m.closeUid) {
        list.push({
          id: `${m._id}:closeUid`,
          uid: m.closeUid,
          medicineId: m._id,
          medicineName: m.name,
        });
      }
    });
    return list;
  }, [medicines]);

  const load = async () => {
    setError(null);
    try {
      const meds = await api.listMedicines();
      setMedicines(meds);
      if (!selectedMedicineId && meds[0]?._id)
        setSelectedMedicineId(meds[0]._id);
    } catch (e: any) {
      setError(e?.message || "Không thể tải danh sách thuốc");
    }
  };

  useEffect(() => {
    load();

    const socket = getSocket();
    const onMedicinesUpdated = () => {
      load();
    };
    socket.on("medicines_updated", onMedicinesUpdated);
    return () => {
      socket.off("medicines_updated", onMedicinesUpdated);
    };
  }, []);

  const startScan = () => {
    setIsScanning(true);
    // Simulate finding a card after 3 seconds
    setTimeout(() => {
      setIsScanning(false);
      const uid = "88-99-AA-BB";
      setScannedUid(uid);
      alert(`Đã nhận diện thẻ: ${uid}`);
    }, 3000);
  };

  const upsertFor = (
    m: Medicine,
    patch: Partial<Pick<Medicine, "uid" | "closeUid">>
  ) => {
    return {
      name: m.name,
      uid: patch.uid ?? m.uid,
      closeUid: patch.closeUid ?? m.closeUid,
      quantity: m.quantity,
      expiryDate: m.expiryDate,
      servoPin: m.servoPin,
      numReminders: m.numReminders,
      reminderTimes: m.reminderTimes,
      reminderTimeout: m.reminderTimeout,
    };
  };

  const assign = async () => {
    if (!scannedUid || !selectedMedicineId) return;
    const med = medicines.find((m: Medicine) => m._id === selectedMedicineId);
    if (!med) return;
    setError(null);
    try {
      const payload = upsertFor(
        med,
        targetField === "uid" ? { uid: scannedUid } : { closeUid: scannedUid }
      );
      await api.updateMedicine(med._id, payload);
      setScannedUid("");
      await load();
    } catch (e: any) {
      setError(e?.message || "Không thể gán thẻ");
    }
  };

  const unlink = async (card: RFIDCard) => {
    const med = medicines.find((m: Medicine) => m._id === card.medicineId);
    if (!med) return;
    const ok = confirm("Gỡ liên kết UID này?");
    if (!ok) return;
    const isClose = card.id.endsWith(":closeUid");
    setError(null);
    try {
      const payload = upsertFor(med, isClose ? { closeUid: "" } : { uid: "" });
      await api.updateMedicine(med._id, payload);
      await load();
    } catch (e: any) {
      setError(e?.message || "Không thể gỡ liên kết");
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3 text-sm font-semibold">
          {error}
        </div>
      )}

      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center">
        <div
          className={`w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center transition-all ${
            isScanning
              ? "bg-cyan-600 text-white animate-pulse"
              : "bg-slate-50 text-slate-400"
          }`}
        >
          <IdCard size={40} />
        </div>
        <h3 className="text-2xl font-bold text-slate-800 mb-2">
          Quản lý thẻ RFID
        </h3>
        <p className="text-slate-500 max-w-md mx-auto mb-8">
          Quét thẻ RFID mới và liên kết với loại thuốc tương ứng để cho phép mở
          tủ tự động.
        </p>
        <button
          onClick={startScan}
          disabled={isScanning}
          className={`flex items-center gap-2 mx-auto px-8 py-3 rounded-xl font-bold shadow-lg transition-all ${
            isScanning
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-cyan-600 text-white hover:bg-cyan-700 shadow-indigo-200"
          }`}
        >
          {isScanning ? (
            <>
              <Activity className="animate-spin" size={20} />
              Đang đợi quét...
            </>
          ) : (
            <>
              <Plus size={20} />
              Thêm thẻ mới
            </>
          )}
        </button>

        <div className="mt-6 max-w-2xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold"
              value={selectedMedicineId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setSelectedMedicineId(e.target.value)
              }
            >
              {medicines.map((m: Medicine) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold"
              value={targetField}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setTargetField(e.target.value as "uid" | "closeUid")
              }
            >
              <option value="uid">UID chính</option>
              <option value="closeUid">Close UID</option>
            </select>
            <button
              onClick={assign}
              disabled={!scannedUid}
              className="px-4 py-2 bg-cyan-600 text-white rounded-xl font-bold text-sm hover:bg-cyan-700 disabled:opacity-50"
            >
              Gán UID vừa quét
            </button>
          </div>
          {scannedUid && (
            <div className="mt-3 text-sm font-semibold text-slate-600">
              UID vừa quét:{" "}
              <span className="font-mono font-bold text-slate-900">
                {scannedUid}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map((card: RFIDCard) => (
          <div
            key={card.id}
            className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-6 group hover:border-indigo-200 transition-colors"
          >
            <div className="p-4 bg-slate-50 rounded-xl text-slate-400 group-hover:bg-cyan-50 group-hover:text-indigo-600 transition-colors">
              <IdCard size={32} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Mã thẻ UID
                </span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                  Đã liên kết
                </span>
              </div>
              <p className="text-lg font-mono font-bold text-slate-800">
                {card.uid}
              </p>
              <div className="mt-2 flex items-center gap-2 text-sm text-indigo-600 font-semibold">
                <Link size={14} />
                Thuốc: {card.medicineName || card.medicineId}
              </div>
            </div>
            <button
              onClick={() => unlink(card)}
              className="p-2 text-slate-300 hover:text-red-500 transition-colors"
            >
              <Unlink size={20} />
            </button>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 flex gap-4">
        <AlertCircle className="text-amber-600 shrink-0" size={24} />
        <div>
          <h4 className="font-bold text-amber-800">Lưu ý quan trọng</h4>
          <p className="text-sm text-amber-700 mt-1">
            Mỗi thẻ RFID chỉ được liên kết với duy nhất một loại thuốc. Khi quét
            đúng thẻ, ngăn tủ tương ứng sẽ được mở và ghi nhận hành động uống
            thuốc thành công.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RFIDManager;
