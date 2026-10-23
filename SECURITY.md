# Security

This app is designed for trusted local use. Keep it bound to loopback; do not put it behind a public proxy. It does not need authentication because it is not intended as a network service.

Do not post sensitive session data or exploit details in a public issue. For a suspected vulnerability, use GitHub's private vulnerability reporting for this repository if enabled; otherwise contact the maintainer privately through the contact details on their GitHub profile before disclosing details. Do not include credentials or raw audio.

The server rejects foreign origins and unexpected Host headers, validates session writes and serves an explicit asset allowlist. Browser audio permission is still required. Device labels and capture identifiers are present in local session metadata; treat that file as private.
