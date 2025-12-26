export interface User {
  name: string;
  email: string;
  picture: string;
}

export interface CabinetStatus {
  isOpen: boolean;
  ledOn: boolean;
  buzzerOn: boolean;
  manualOverride: boolean;
  lastSync: string;
}

export interface Medicine {
  _id: string;
  name: string;
  uid: string;
  closeUid: string;
  quantity: number;
  expiryDate: string;
  servoPin: number;
  numReminders: number;
  reminderTimes: string[];
  reminderTimeout: number;
  createdAt: string;
  updatedAt: string;
}

export interface RFIDCard {
  id: string;
  uid: string;
  medicineId: string;
  medicineName?: string;
}

export interface HealthDataPoint {
  time: string;
  bpm: number;
  spo2: number;
}

export interface Log {
  _id: string;
  deviceID: string;
  timestamp: string;
  cardUID: string;
  action: string;
  servo: string;
  details: string;
  success: boolean;
  createdAt: string;
}

export interface Config {
  _id?: string;
  servoTimeout: number;
  lockRFIDOutsideReminder: boolean;
  wifiSSID: string;
  wifiPassword: string;
  updatedAt: string;
}

export interface Recipient {
  _id: string;
  chatID: number;
  active: boolean;
  createdAt: string;
}

export interface Sensor {
  _id: string;
  deviceID: string;
  heartRate: number;
  spo2: number;
  timestamp: string;
  createdAt: string;
}
