import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    middlewareMode: false
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url && req.url.endsWith('/app.js')) {
        res.statusCode = 404;
        res.end('Not Found');
        return;
      }
      next();
    });
  }
});
