from typing import Any, cast

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    status_code: int = 500
    code: str = "app_error"

    def __init__(
        self,
        detail: str = "An error occurred",
        *,
        code: str | None = None,
        status: int | None = None,
    ) -> None:
        self.detail = detail
        self.code = code or self.code
        self.status = status or self.status_code
        super().__init__(detail)


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"


class ConflictError(AppError):
    status_code = 409
    code = "conflict"


class ValidationError(AppError):
    status_code = 422
    code = "validation_error"


class PermissionDeniedError(AppError):
    status_code = 403
    code = "permission_denied"


class UnauthorizedError(AppError):
    status_code = 401
    code = "unauthorized"


class ServiceUnavailableError(AppError):
    status_code = 503
    code = "service_unavailable"


class BadRequestError(AppError):
    status_code = 400
    code = "bad_request"


async def app_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    exc = cast(AppError, exc)
    content: dict[str, Any] = {"detail": exc.detail, "code": exc.code, "status": exc.status}
    return JSONResponse(status_code=exc.status, content=content)


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, app_exception_handler)
