from sqlalchemy import JSON as _SQLAlchemyJSON


class JSON(_SQLAlchemyJSON):
    """JSON column type for the ASHA Sathi models.

    Date/datetime serialization is handled by the engine-level
    ``json_serializer=json_dumps`` configured in app.core.database (and the test
    engine in tests/conftest.py).
    """
