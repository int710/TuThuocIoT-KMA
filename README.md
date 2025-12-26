# 💊 Smart Medicine Box v2.0 (IoT Healthcare System)

Hệ thống quản lý tủ thuốc thông minh và theo dõi sức khỏe tích hợp IoT. Giải pháp giúp nhắc nhở người dùng uống thuốc đúng giờ, giám sát hành vi lấy thuốc và theo dõi chỉ số sinh tồn (Nhịp tim/SpO2) theo thời gian thực.

---

## 🚀 Tính năng nổi bật

- **🔔 Nhắc nhở đa phương thức:** Cảnh báo qua âm thanh (Buzzer), ánh sáng (LED), App di động (Blynk) và tin nhắn Telegram.
- **💳 Xác thực RFID:** Chỉ mở ngăn thuốc khi quẹt thẻ hợp lệ, ghi lại chính xác danh tính người dùng.
- **💓 Theo dõi sinh hiệu:** Tích hợp cảm biến MAX30102 đo Nhịp tim & SpO2, hiển thị biểu đồ thời gian thực (Real-time Chart).
- **📊 Dashboard Quản lý:** Giao diện Web hiện đại để cấu hình lịch uống thuốc, theo dõi tồn kho và xem nhật ký (Logs).
- **🛡️ An toàn tuyệt đối:** Chế độ mở khẩn cấp (Emergency Button) và cảnh báo bỏ liều thuốc (Missed dose) đến người thân.

---

## 🛠️ Cấu trúc hệ thống (Tech Stack)

- **Firmware:** C++, Arduino Framework (ESP32).
- **Backend:** Node.js, Express, Socket.io (Real-time).
- **Database:** MongoDB (Lưu lịch sử và cấu hình thuốc).
- **Frontend:** React.js, Tailwind CSS, Recharts.
- **Communication:** MQTT (Aedes Broker), HTTP, WebSockets.
- **Third-party:** Blynk IoT, Telegram Bot API.

---

## 📋 Hướng dẫn cài đặt

### 1. Cấu hình Phần cứng (ESP32)

1. **Sơ đồ chân (Pinout):**

- RFID (RC522): `SCK:18, MISO:19, MOSI:23, SS:5, RST:22`
- Cảm biến MAX30102: `SDA:25, SCL:26`
- Servo: `GPIO 21`, Buzzer: `GPIO 4`, Button: `GPIO 14`.

2. **Cài đặt thư viện:** Cài đặt `PubSubClient`, `ArduinoJson`, `MFRC522`, `Blynk`, `MAX30105` qua Library Manager trên Arduino IDE.
3. **Cấu hình Code:** Mở file firmware và cập nhật:

```cpp
const char* ssid = "Tên_WiFi";
const char* pass = "Mật_khẩu";
const char* mqttServer = "IP_Máy_Tính_Chạy_Backend";
#define BLYNK_AUTH_TOKEN "Token_Của_Bạn"

```

### 2. Cài đặt Backend

1. Di chuyển vào thư mục backend: `cd backend`
2. Cài đặt dependencies: `npm install`
3. Cấu hình file `.env`:

```env
MONGODB_URI=mongodb://localhost:27017/medicine_box
PORT=5000
TELEGRAM_BOT_TOKEN=your_token

```

4. Chạy server: `npm start` hoặc `node server.js`

### 3. Cài đặt Web Dashboard

1. Di chuyển vào thư mục frontend: `cd frontend`
2. Cài đặt dependencies: `npm install`
3. Chạy ứng dụng: `npm run dev`
4. Truy cập: `http://localhost:5173`

---

## ⚙️ Cấu hình Blynk (Mobile App)

Để hiển thị biểu đồ nhịp tim mượt mà:

1. **Datastreams:** Tạo `V0` (Heart Rate - Integer) và `V1` (SpO2 - Integer).
2. **Widgets:** \* Thêm **SuperChart**: Gán 2 Datastream V0, V1 để vẽ biểu đồ.

- Thêm **Notification**: Để nhận cảnh báo đẩy khi quên thuốc.

---

## 🔄 Luồng hoạt động cơ bản

1. **Cấu hình:** Người dùng đặt lịch uống thuốc trên Web Dashboard.
2. **Đồng bộ:** ESP32 tự động tải lịch từ Backend qua HTTP khi khởi động.
3. **Báo thức:** Đến giờ hẹn, ESP32 kêu còi. Người dùng quẹt thẻ RFID.
4. **Hành động:** Hộp mở (Servo), dữ liệu xác nhận "Đã uống" gửi về Backend qua MQTT.
5. **Giám sát:** Người dùng đặt tay lên cảm biến, dữ liệu nhịp tim đẩy lên Web và Blynk theo thời gian thực qua Socket.io.

---

## 🤝 Đóng góp & Liên hệ

Dự án được phát triển bởi int710 (ThanhQuan) & Nguyễn Tuấn Anh, Hoàng Bảo Phúc trong bộ môn Thiết kế hệ thống Nhúng. Mọi thắc mắc vui lòng liên hệ qua Telegram hoặc mở một Issue trên GitHub.

---

> **Lưu ý:** Đảm bảo ESP32 và Máy tính chạy Backend cùng kết nối chung một mạng WiFi để các gói tin MQTT có thể lưu thông chính xác.

---

Hình ảnh sản phẩm
![Mô tả ảnh](https://i.imgur.com/UC0as0f.png)
![Mô tả ảnh](https://i.imgur.com/c71zyPq.png)
![Mô tả ảnh](https://i.imgur.com/0mfMrvY.png)
![Mô tả ảnh](https://i.imgur.com/xvjTZED.png)
![Mô tả ảnh](https://i.imgur.com/FXI9alN.png)
