web: cd backend && gunicorn --bind 0.0.0.0:$PORT --workers 4 --threads 8 --worker-class gthread --timeout 3600 --graceful-timeout 3600 --keep-alive 75 app:app
