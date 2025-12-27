# Gunicorn configuration file
import os

# Server socket
bind = f"0.0.0.0:{os.getenv('PORT', '8080')}"
backlog = 2048

# Worker processes
workers = 4
worker_class = 'gthread'
threads = 8
worker_connections = 1000
max_requests = 0
max_requests_jitter = 0

# Timeout settings - Very long timeout for SSE connections
timeout = 3600  # 1 hour
graceful_timeout = 3600  # 1 hour
keepalive = 75

# Logging
accesslog = '-'
errorlog = '-'
loglevel = 'info'
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

# Process naming
proc_name = 'windmill-monitor'

# Server mechanics
daemon = False
pidfile = None
umask = 0
user = None
group = None
tmp_upload_dir = None

# SSL
keyfile = None
certfile = None
