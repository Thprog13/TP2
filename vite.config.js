import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1", // <--- Forces the server to use IPv4
    port: 5173, // <--- Forces it back to port 5173
  },
});
