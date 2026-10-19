// PM2 — chạy Next.js trên VPS Hostinger (phía sau Nginx)
module.exports = {
  apps: [
    {
      name: "noi-tai-an",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000 -H 127.0.0.1",
      cwd: __dirname,
      exec_mode: "fork",
      instances: 1,
      max_memory_restart: "800M",
      env: { NODE_ENV: "production" },
      time: true,
    },
  ],
};
