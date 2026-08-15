from celery.schedules import crontab

from app.tasks.celery_app import celery_app

celery_app.conf.beat_schedule = {
    "send-due-reminders-every-15-minutes": {
        "task": "app.tasks.notification_tasks.send_due_reminders",
        "schedule": 900.0,
    },
    "process-notification-queue-every-minute": {
        "task": "app.tasks.notification_tasks.process_notification_queue",
        "schedule": 60.0,
    },
    "daily-sync-cleanup": {
        "task": "app.tasks.notification_tasks.cleanup_stale_sync_logs",
        "schedule": crontab(hour=2, minute=0),
    },
}
