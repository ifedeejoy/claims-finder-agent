module.exports = {
  apps: [{
    name: 'claim-finder-backend',
    script: './dist/server-simple.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    max_memory_restart: '512M',
    cron_restart: '0 0 * * *', // Restart daily at midnight
    watch: false,
    ignore_watch: ['node_modules', 'logs'],
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000
  }]
} 