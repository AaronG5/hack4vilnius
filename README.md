# hack4vilnius
A gamified platform to report cities problems.

This project is made for the [Hack4Vilnius 2026](https://hack4vilnius.lt/) hackathon

## Backend

### Run apps
#### Setup
Have python, uv installed and run
```bash
cd ./src/backend
uv sync
```

#### Usage
To start the server
```bash
cd ./src/backend
uv run python manage.py runserver
```

### Development
#### Setup
```bash
cd ./src/backend
uv sync --group dev
```

#### Run tests and formatters
```bash
cd ./src/backend
uv run ruff format
uv run ruff check
uv run basedpyright
```

#### Run migrations and apply them
```bash
cd ./src/backend
uv run python manage.py makemigrations
uv run python manage.py migrate
```
