from app.main import health, public_settings


def test_health_endpoint():
    assert health() == {"status": "ok"}


def test_public_settings_returns_branding():
    settings = public_settings()
    assert "app_name" in settings
    assert "periods_per_day" in settings
    assert "day_order_max" in settings
