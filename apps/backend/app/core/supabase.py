from supabase import Client, create_client

from app.core.config import settings

_supabase_client: Client | None = None


def supabase_client() -> Client | None:
    """Return a singleton Supabase client (or None when not configured)."""
    global _supabase_client
    if not settings.supabase_url or not settings.supabase_anon_key:
        return None
    if _supabase_client is None:
        _supabase_client = create_client(settings.supabase_url, settings.supabase_anon_key)
    return _supabase_client


def get_supabase() -> Client | None:
    return supabase_client()
