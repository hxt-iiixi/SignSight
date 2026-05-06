.PHONY: backend app web-client dev dev-all

backend:
	cd backend && .venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload

app:
	cd app && npx expo start -c

web-client:
	cd web-frontend && npm run dev

dev: 
	$(MAKE) -j2 backend app

dev-all: 
	$(MAKE) -j3 backend app web-client