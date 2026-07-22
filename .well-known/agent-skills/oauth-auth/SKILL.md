# OAuth Authentication — Real Estate Capitale

How agents obtain access tokens for the Rabat Immobilier API.

## Discovery

Fetch Protected Resource Metadata:

    GET /.well-known/oauth-protected-resource

Fetch Authorization Server Metadata:

    GET /.well-known/oauth-authorization-server

## Authentication Methods

- **anonymous** — No user identity required. Register with `{"type": "anonymous"}`.
- **service_auth** — User email known. Register with `{"type": "service_auth", "login_hint": "user@example.com"}`.

## Flow

1. Register identity at `/agent/identity`
2. Exchange assertion for token at `/oauth2/token`
3. Use Bearer token in `Authorization` header for API requests
