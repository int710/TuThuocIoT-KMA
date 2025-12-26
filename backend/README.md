# ESP32 Backend

This service runs a local MQTT broker and bridges sensor messages to Socket.IO for the frontend.

Quick start:

```bash
cd esp32-backend
npm install
node server.js   # or npm run dev (requires nodemon)
```

MQTT broker listens on port `1883`. HTTP / Socket.IO runs on `3001`.
