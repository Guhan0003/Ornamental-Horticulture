"""
Generate an ADMIN_PASSWORD_HASH so no readable password sits in your hosting
dashboard.

    python scripts/hash_password.py

Paste the output as ADMIN_PASSWORD_HASH and leave ADMIN_PASSWORD unset.
"""

import getpass
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.security import MAX_PASSWORD_BYTES, hash_password  # noqa: E402


def main() -> int:
    password = getpass.getpass("Password: ")
    if password != getpass.getpass("Confirm password: "):
        print("Passwords do not match.", file=sys.stderr)
        return 1

    if len(password) < 8:
        print("Use at least 8 characters.", file=sys.stderr)
        return 1

    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        print(f"At most {MAX_PASSWORD_BYTES} bytes, please.", file=sys.stderr)
        return 1

    print("\nADMIN_PASSWORD_HASH=" + hash_password(password))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
