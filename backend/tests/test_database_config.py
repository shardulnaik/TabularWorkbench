from sqlalchemy.engine import make_url

from app.core.config import Settings


def test_mysql_database_url_is_accepted():
    database_url = (
        "mysql+pymysql://tabular_user:test_password@127.0.0.1:3306/"
        "tabular_workbench?charset=utf8mb4"
    )
    settings = Settings(_env_file=None, database_url=database_url)

    assert settings.database_url == database_url
    assert make_url(settings.database_url).drivername == "mysql+pymysql"


def test_database_url_loads_from_dotenv_file(tmp_path, monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    env_file = tmp_path / ".env"
    env_file.write_text(
        "DATABASE_URL=mysql+pymysql://local_user:local_password@127.0.0.1:3306/app\n",
        encoding="utf-8",
    )

    settings = Settings(_env_file=env_file)

    assert make_url(settings.database_url).drivername == "mysql+pymysql"
    assert make_url(settings.database_url).username == "local_user"


def test_environment_database_url_overrides_dotenv_file(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "DATABASE_URL=mysql+pymysql://local_user:local_password@127.0.0.1:3306/app\n",
        encoding="utf-8",
    )
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql://production_user:production_password@db.example.test/app",
    )

    settings = Settings(_env_file=env_file)

    assert make_url(settings.database_url).drivername == "postgresql+psycopg"
    assert make_url(settings.database_url).username == "production_user"


def test_postgresql_database_url_uses_psycopg3():
    settings = Settings(
        _env_file=None,
        database_url="postgresql://test_user:test_password@db.example.test/app?sslmode=require",
    )

    url = make_url(settings.database_url)
    assert url.drivername == "postgresql+psycopg"
    assert url.query["sslmode"] == "require"


def test_legacy_postgres_scheme_uses_psycopg3():
    settings = Settings(
        _env_file=None,
        database_url="postgres://test_user:test_password@db.example.test/app",
    )

    assert make_url(settings.database_url).drivername == "postgresql+psycopg"


def test_explicit_psycopg_url_is_preserved():
    database_url = "postgresql+psycopg://test_user:test_password@db.example.test/app"
    settings = Settings(_env_file=None, database_url=database_url)

    assert settings.database_url == database_url


def test_database_url_has_no_hardcoded_default():
    assert Settings.model_fields["database_url"].is_required()
