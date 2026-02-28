# Gunicorn configuration file
import os

# Server socket
bind = f"0.0.0.0:{os.getenv('PORT', '8080')}"

# Worker processes - use gevent for SSE support
workers = 1
worker_class = 'gevent'
worker_connections = 1000

# Timeout settings
timeout = 120
graceful_timeout = 30
keepalive = 75

# Logging
accesslog = '-'
errorlog = '-'
loglevel = 'info'
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

# Process naming
proc_name = 'windmill-monitor'
daemon = False
