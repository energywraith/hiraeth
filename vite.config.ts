import { defineConfig } from "vite";

const port = Number(process.env.PORT) || 4173;

export default defineConfig({
  server: { port },
  preview: { port },
});
