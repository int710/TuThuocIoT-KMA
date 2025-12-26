# SmartMedi (FEv2)

Frontend quản lý **Smart Medicine Box**.

- UI: React + TypeScript + TailwindCSS
- Realtime: Socket.IO client
- Backend (BE v2): Express + MongoDB + MQTT (FE chỉ dùng HTTP + Socket.IO)

## Yêu cầu

- Node.js 18+ (khuyến nghị 18/20)
- Backend chạy được (mặc định `http://localhost:3001`)

## Cài đặt & chạy Frontend

Tại thư mục `FEv2`:

```bash
npm install
npm run dev
```

Mặc định FE chạy ở:

- `http://localhost:5173`

## Cấu hình môi trường (tuỳ chọn)

Nếu BE không chạy ở `localhost:3001`, tạo file `.env` trong `FEv2`:

```env
VITE_API_BASE_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
```

- `VITE_API_BASE_URL`: base URL cho REST API
- `VITE_SOCKET_URL`: base URL cho Socket.IO

## Mapping màn hình -> API BE

### 1) Tổng quan (Dashboard)

- **REST**
  - `GET /medicines`
  - `GET /logs?limit=200`
  - `GET /sensors/latest`
- **Socket.IO**
  - `new_log`
  - `sensor_data`
  - `medicines_updated`

### 2) Quản lý thuốc

- **REST**
  - `GET /medicines`
  - `POST /medicines`
  - `PUT /medicines/:id`
  - `DELETE /medicines/:id`
- **Socket.IO**
  - `medicines_updated`
  - `medicine_qty_updated`

Ghi chú:
- BE dùng MongoDB `_id` làm ID chính.
- Trường liên quan RFID nằm trong `Medicine.uid` và `Medicine.closeUid`.

### 3) Thẻ RFID

BE không có endpoint riêng cho RFID card.
FE quản lý **mapping RFID <-> thuốc** thông qua:
- `Medicine.uid`
- `Medicine.closeUid`

- **REST**
  - `GET /medicines`
  - `PUT /medicines/:id` (cập nhật `uid/closeUid`)

### 4) Sức khỏe

- **REST**
  - `GET /sensors?limit=60`
- **Socket.IO**
  - `sensor_data`

### 5) Lịch sử (Logs)

- **REST**
  - `GET /logs?limit=200`
- **Socket.IO**
  - `new_log`

Hỗ trợ:
- Tìm kiếm nhanh theo `action/cardUID/details/deviceID`
- Export CSV

### 6) Cài đặt

- **Config**
  - `GET /config`
  - `POST /config`
  - Socket: `config_updated`

- **Telegram recipients**
  - `GET /recipients`
  - `POST /recipients`
  - `DELETE /recipients/:id`
  - Socket: `recipients_updated`

### 7) Điều khiển (Console)

Tab Console hiện để **mô phỏng UI**, không bắt buộc call BE.

## Realtime events (Socket.IO)

BE phát các event (FE đang dùng những event sau):

- `initial_status`: trạng thái ban đầu khi connect
- `status_update`: trạng thái realtime từ ESP32
- `new_log`: có log mới
- `sensor_data`: dữ liệu sức khỏe realtime
- `medicines_updated`: danh sách thuốc thay đổi (create/update/delete)
- `medicine_qty_updated`: cập nhật số lượng thuốc
- `config_updated`: config thay đổi
- `recipients_updated`: danh sách recipients thay đổi

## Checklist test nhanh

1) **Kết nối BE**
- Mở `http://localhost:3001/health` trả `{ status: "OK" ... }`

2) **Dashboard**
- Có hiển thị số thuốc (từ `/medicines`)
- Nếu BE nhận sensor/log qua MQTT, FE sẽ realtime cập nhật

3) **Quản lý thuốc**
- Thêm thuốc mới (name/uid/quantity)
- Sửa thuốc (uid/closeUid/quantity/reminderTimes)
- Xóa thuốc

4) **RFID**
- Quét mô phỏng và gán UID vừa quét vào 1 thuốc
- Refresh lại vẫn thấy UID đã gán

5) **Settings**
- Thay đổi `servoTimeout`, `lockRFIDOutsideReminder`, `wifiSSID/wifiPassword`, bấm lưu
- Thêm/Xóa Telegram Chat ID

## Ghi chú về lỗi IDE kiểu "Cannot find module react"

Nếu IDE báo thiếu `react`, `vite`, `lucide-react`, `socket.io-client`, ... thì chỉ cần chạy:

```bash
npm install
```

Sau đó các lỗi sẽ hết.
