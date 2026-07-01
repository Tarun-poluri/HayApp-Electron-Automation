"""
Provision Haystack credentials into the OS keyring.
Powershell(windows)
Usage:
    1. $AUTH_KEY = @"
    2. YOUR_HAYSCAN_AUTH_KEY
    3. @"
    4. $AUTH_KEY | python3.11 scripts/provision_haystack.py --api-key YOUR_API_KEY
    --group-id YOUR_GROUP_ID --hayScan-auth-key -
"""

import argparse
import getpass
import sys

try:
    import keyring
except Exception:
    print(
        "Error: the 'keyring' package is required. Install with: pip install keyring",
        file=sys.stderr,
    )
    raise SystemExit(1)


SERVICE_NAME = "hayapp"
API_KEY_NAME = "api_key"
GROUP_ID_NAME = "group_id"
HAYSCAN_AUTH_KEY = "hayScan_auth_key"


def parse_args():
    p = argparse.ArgumentParser(
        description="Store Haystack API key and group id, and HayScan Auth Key in keyring."
    )
    p.add_argument("--api-key", help="Haystack API key")
    p.add_argument("--group-id", help="Haystack group id")
    p.add_argument("--hayScan-auth-key", help="HayScan Auth Key")
    p.add_argument("--yes", "-y", action="store_true", help="Do not prompt for confirmation")
    return p.parse_args()


def prompt_if_missing(args):
    if not args.api_key:
        args.api_key = getpass.getpass("API key: ").strip()
    if not args.group_id:
        args.group_id = input("Group id: ").strip()
    if not args.hayScan_auth_key:
        args.hayScan_auth_key = input("HayScan Auth Key: ").strip()
    return args


def confirm(args):
    if args.yes:
        return True
    print("\nWill store credentials in keyring hayapp:")
    print(f"  {API_KEY_NAME}: {args.api_key}")
    print(f"  {GROUP_ID_NAME}: {args.group_id}")
    print(f"  {HAYSCAN_AUTH_KEY}: {args.hayScan_auth_key}")
    print(" Proceed? [y/N]: ", end="", flush=True)

    if sys.platform == "win32":
        with open("CONIN$", "r") as con:
            resp = con.readline().strip().lower()
    else:
        with open("/dev/tty", "r") as tty:
            resp = tty.readline().strip().lower()
    return resp == "y" or resp == "yes"


def store_credentials(service, api_key, group_id, hayScan_auth_key):
    try:
        keyring.set_password(service, API_KEY_NAME, api_key)
        keyring.set_password(service, GROUP_ID_NAME, group_id)
        chunk_size = 1000
        chunks = [
            hayScan_auth_key[i : i + chunk_size]
            for i in range(0, len(hayScan_auth_key), chunk_size)
        ]
        keyring.set_password(service, f"{HAYSCAN_AUTH_KEY}_count", str(len(chunks)))
        for i, chunk in enumerate(chunks):
            keyring.set_password(service, f"{HAYSCAN_AUTH_KEY}_part_{i}", chunk)
    except Exception as e:
        print(f"Error storing credentials in keyring: {e}", file=sys.stderr)
        return False
    return True


def main():
    args = parse_args()
    if args.hayScan_auth_key == "-":
        print("Reading RSA key from stdin...")
        args.hayScan_auth_key = sys.stdin.read().strip()
    args = prompt_if_missing(args)

    if not args.api_key or not args.group_id or not args.hayScan_auth_key:
        print("All three api-key, group-id, and hayScan-auth-key are required.", file=sys.stderr)
        raise SystemExit(2)

    if not confirm(args):
        print("Aborted.")
        raise SystemExit(0)

    ok = store_credentials(SERVICE_NAME, args.api_key, args.group_id, args.hayScan_auth_key)
    if not ok:
        raise SystemExit(3)

    print("Credentials stored successfully.")


if __name__ == "__main__":
    main()
