# Backend Tests

The backend test suite uses Python's built-in `unittest` runner so it can run with the existing backend dependencies.

Run from the repository root:

```bash
backend/.venv/bin/python -m unittest discover -s backend/tests -v
```

The suite currently covers:

- FastAPI application route registration.
- Pydantic request schema validation.
- Landmark feature extraction helpers.
- Gesture frame vectorization helpers.
- Upload path safety.
- Feedback service normalization and persistence calls.
- Basic classifier input validation.

