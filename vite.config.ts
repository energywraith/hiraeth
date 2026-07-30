import { defineConfig } from "vite";

const port = Number(process.env.PORT) || 4173;

export default defineConfig({
  base: "/hiraeth/",
  server: { port },
  preview: { port },
});
