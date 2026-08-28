"""
Create the first admin account.

There is no public signup — accounts are created here or by an existing admin.

    python scripts/create_admin.py
    python scripts/create_admin.py --email you@example.com --name "Your Name"
"""

import argparse
import getpass
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.security import MAX_PASSWORD_BYTES, hash_password  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.models.user import Role, User  # noqa: E402
import app.models  # noqa: E402,F401


def main() -> int:
    parser = argparse.ArgumentParser(description="Create an admin user.")
    parser.add_argument("--email")
    parser.add_argument("--name")
    parser.add_argument(
        "--role", choices=[r.value for r in Role], default=Role.ADMIN.value
    )
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)

    email = args.email or input("Email: ").strip()
    if not email:
        print("Email is required.", file=sys.stderr)
        return 1

    name = args.name or input("Full name: ").strip() or None

    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == email).first():
            print(f"A user with email {email} already exists.", file=sys.stderr)
            return 1

        password = getpass.getpass("Password: ")
        if password != getpass.getpass("Confirm password: "):
            print("Passwords do not match.", file=sys.stderr)
            return 1

        if len(password) < 8:
            print("Password must be at least 8 characters.", file=sys.stderr)
            return 1

        if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
            print(
                f"Password must be at most {MAX_PASSWORD_BYTES} bytes.", file=sys.stderr
            )
            return 1

        user = User(
            email=email,
            full_name=name,
            hashed_password=hash_password(password),
            role=Role(args.role),
        )
        db.add(user)
        db.commit()
        print(f"Created {args.role} account for {email}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
