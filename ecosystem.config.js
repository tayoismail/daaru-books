/**
 * PM2 process config for VPS deployments (Hostinger KVM / TrueHost Cloud VPS).
 *
 * First run on the server:
 *   npm ci && npm run build
 *   pm2 startOrReload ecosystem.config.js --env production
 *   pm2 save            # make it survive server reboots
 *   pm2 startup         # follow the printed instructions
 *
 * Redeploys never lose data: run scripts/deploy.sh (git pull only updates
 * code; data/ is gitignored and self-heals from backups if ever missing).
 */
module.exports = {
  apps: [
    {
      name: "daaru-books",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start",
      instances: 1,
      exec_mode: "fork",
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
        // Best-practice on a VPS: keep live data OUTSIDE the deploy folder so
        // no redeploy can ever touch it. Uncomment and create the dir once:
        //   mkdir -p /var/lib/daaru/data
        //   chown <deploy-user> /var/lib/daaru/data
        // DATA_DIR: "/var/lib/daaru/data",
      },
      max_memory_restart: "500M",
    },
  ],
};
