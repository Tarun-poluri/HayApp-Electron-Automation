"""
Script to clear stored credentials from keyring.

This script removes the API key, group ID, and HayScan auth key from the OS keyring.

Usage:
    python3.11 scripts/clear_credentials.py [--api-key] [--group-id] [--hayscan-key] [--all]

Options:
    --api-key      Clear only the API key
    --group-id     Clear only the group ID
    --hayscan-key  Clear only the HayScan auth key
    --all          Clear all credentials (default if no options specified)
"""

import argparse
import sys

try:
    import keyring
except ImportError:
    print(
        "Error: the 'keyring' package is required. Install with: pip install keyring",
        file=sys.stderr,
    )
    sys.exit(1)


SERVICE_NAME = "hayapp"
API_KEY_NAME = "api_key"
GROUP_ID_NAME = "group_id"
HAYSCAN_AUTH_KEY = "hayScan_auth_key"


def clear_api_key():
    """Clear the API key from keyring."""
    try:
        keyring.delete_password(SERVICE_NAME, API_KEY_NAME)
        print("✓ API key cleared")
        return True
    except keyring.errors.PasswordDeleteError:
        print("✗ API key not found in keyring")
        return False
    except Exception as e:
        print(f"✗ Error clearing API key: {e}")
        return False


def clear_group_id():
    """Clear the group ID from keyring."""
    try:
        keyring.delete_password(SERVICE_NAME, GROUP_ID_NAME)
        print("✓ Group ID cleared")
        return True
    except keyring.errors.PasswordDeleteError:
        print("✗ Group ID not found in keyring")
        return False
    except Exception as e:
        print(f"✗ Error clearing group ID: {e}")
        return False


def clear_hayscan_key():
    """Clear the HayScan auth key from keyring."""
    try:
        # Clear the count first
        try:
            count = keyring.get_password(SERVICE_NAME, f"{HAYSCAN_AUTH_KEY}_count")
            if count:
                count = int(count)
                # Clear all parts
                for i in range(count):
                    try:
                        keyring.delete_password(SERVICE_NAME, f"{HAYSCAN_AUTH_KEY}_part_{i}")
                    except keyring.errors.PasswordDeleteError:
                        pass
                # Clear the count
                keyring.delete_password(SERVICE_NAME, f"{HAYSCAN_AUTH_KEY}_count")
        except (keyring.errors.PasswordDeleteError, ValueError, TypeError):
            pass
        print("✓ HayScan auth key cleared")
        return True
    except Exception as e:
        print(f"✗ Error clearing HayScan auth key: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Clear stored credentials from keyring.")
    parser.add_argument("--api-key", action="store_true", help="Clear only the API key")
    parser.add_argument("--group-id", action="store_true", help="Clear only the group ID")
    parser.add_argument(
        "--hayscan-key", action="store_true", help="Clear only the HayScan auth key"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        default=True,
        help="Clear all credentials (default)",
    )

    args = parser.parse_args()

    # If specific flags are set, only clear those
    if args.api_key or args.group_id or args.hayscan_key:
        args.all = False

    print("Clearing credentials from keyring...")
    print("=" * 50)

    results = []

    if args.all or args.api_key:
        results.append(clear_api_key())

    if args.all or args.group_id:
        results.append(clear_group_id())

    if args.all or args.hayscan_key:
        results.append(clear_hayscan_key())

    print("=" * 50)

    if any(results):
        print("\n✓ Credentials cleared successfully!")
        return 0
    else:
        print("\n✗ No credentials were found or cleared.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
