import type { Config, Log, Medicine, Recipient, Sensor } from "../types";

const DEFAULT_BASE_URL = "http://localhost:3001";

function getBaseUrl() {
  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL as
    | string
    | undefined;
  return (envUrl && envUrl.trim()) || DEFAULT_BASE_URL;
}

type MedicineUpsertPayload = Pick<
  Medicine,
  | "name"
  | "uid"
  | "closeUid"
  | "quantity"
  | "expiryDate"
  | "servoPin"
  | "numReminders"
  | "reminderTimes"
  | "reminderTimeout"
>;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = data?.error || data?.message || `HTTP ${res.status}`;
    throw new Error(message);
  }

  return data as T;
}

export const api = {
  baseUrl: getBaseUrl,

  getHealth: () =>
    request<{
      status: string;
      timestamp: string;
      mongodb: boolean;
      mqtt: boolean;
    }>("/health"),

  getStatus: () => request<any>("/status"),

  control: (action: string) =>
    request<{ message: string }>("/control", {
      method: "POST",
      body: JSON.stringify({ action }),
    }),

  getStats: () =>
    request<{
      medicineCount: number;
      logCount: number;
      recipientCount: number;
      latestLogs: Log[];
      latestSensor: Sensor | {};
      currentStatus: any;
    }>("/stats"),

  listMedicines: () => request<Medicine[]>("/medicines"),

  createMedicine: (
    payload: Partial<Medicine> & Pick<Medicine, "name" | "uid" | "quantity">
  ) =>
    request<Medicine>("/medicines", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateMedicine: (id: string, payload: MedicineUpsertPayload) =>
    request<Medicine>(`/medicines/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteMedicine: (id: string) =>
    request<{ message: string }>(`/medicines/${id}`, { method: "DELETE" }),

  updateMedicineQuantity: (id: string, quantity: number) =>
    request<Medicine>(`/medicines/${id}/quantity`, {
      method: "PATCH",
      body: JSON.stringify({ quantity }),
    }),

  listLogs: (limit = 50) => request<Log[]>(`/logs?limit=${limit}`),

  listLogsByCardUid: (cardUID: string) =>
    request<Log[]>(`/logs/${encodeURIComponent(cardUID)}`),

  listLogsByAction: (action: string, limit = 20) =>
    request<Log[]>(`/logs/action/${encodeURIComponent(action)}?limit=${limit}`),

  getConfig: () => request<Config>("/config"),

  updateConfig: (payload: Partial<Config>) =>
    request<Config>("/config", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listRecipients: () => request<Recipient[]>("/recipients"),

  createRecipient: (chatID: number) =>
    request<Recipient>("/recipients", {
      method: "POST",
      body: JSON.stringify({ chatID }),
    }),

  deleteRecipient: (id: string) =>
    request<{ message: string }>(`/recipients/${id}`, { method: "DELETE" }),

  listSensors: (limit = 100) => request<Sensor[]>(`/sensors?limit=${limit}`),

  getLatestSensor: () => request<Sensor | {}>("/sensors/latest"),

  debugSync: () =>
    request<{ success: boolean; message: string }>("/debug/sync", {
      method: "POST",
    }),
};
