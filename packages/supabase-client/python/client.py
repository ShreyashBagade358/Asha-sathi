"""
ASHA Sathi Python Supabase Client Wrapper
"""

import os
from typing import Optional


class SupabaseService:
    def __init__(self, url: Optional[str] = None, service_role_key: Optional[str] = None):
        self.url = url or os.getenv("SUPABASE_URL", "http://localhost:18000")
        self.service_role_key = service_role_key or os.getenv("SUPABASE_SERVICE_KEY", "")

    def is_configured(self) -> bool:
        return bool(self.url and self.service_role_key)


_service_instance: Optional[SupabaseService] = None


def get_supabase_service() -> SupabaseService:
    global _service_instance
    if _service_instance is None:
        _service_instance = SupabaseService()
    return _service_instance
