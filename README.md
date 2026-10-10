# hack4vilnius
A gamified platform to report cities problems.

This project is made for the [Hack4Vilnius 2026](https://hack4vilnius.lt/) hackathon

## Backend

### Run apps
#### Setup
Have python, uv installed and run
```bash
uv sync
```

#### Usage
To start the server
```bash
uv --directory ./src/backend run python manage.py runserver
```
> View api schema with http://127.0.0.1:8000/api/schema/swagger-ui/

API docs (Swagger UI / ReDoc / raw OpenAPI schema) are served at:
- `/api/schema/swagger-ui/`
- `/api/schema/redoc/`
- `/api/schema/`

### Development
#### Setup
```bash
uv sync --group dev
```

#### Run tests and formatters
```bash
uv --directory ./src/backend run ruff format
uv --directory ./src/backend run ruff check
uv --directory ./src/backend run basedpyright
uv --directory ./src/backend run pytest
```

#### Run migrations and apply them
```bash
uv --directory ./src/backend run python manage.py makemigrations
uv --directory ./src/backend run python manage.py migrate
```
