"""
Script to sync group data after device provisioning.

This script downloads all group-specific data from the cloud:
- Surgeons
- HayApp users (CIR/SCR credentials)
- Case types
- Suture sheets
- Needle database and images

Usage:
    python3.11 scripts/sync_group_data.py

The script uses the API key and group_id stored in the keyring from provisioning.
"""

import asyncio
import sys
from pathlib import Path

from hayapp_python.items.data_store import DataStore

# Add parent directory to path to import hayapp_python modules
sys.path.insert(0, str(Path(__file__).parent.parent))


async def main():
    """Sync all group data from the cloud."""
    print("Starting group data sync...")
    print("=" * 50)

    data_store = DataStore(auto_migrate=False)
    results = await data_store.sync_group_data()

    print("\nSync Results:")
    print("=" * 50)

    # Print results for each data type
    for data_type, result in results.items():
        status = "✓" if result["success"] else "✗"
        if data_type in ["needle_db", "needle_images"]:
            updated_status = " (updated)" if result.get("updated") else " (no update needed)"
            print(f"{status} {data_type}: {result.get('error', 'Success')}{updated_status}")
        else:
            count = result.get("count", 0)
            error = result.get("error")
            if error:
                print(f"{status} {data_type}: {error} (count: {count})")
            else:
                print(f"{status} {data_type}: {count} items synced")

    print("=" * 50)

    # Check if all syncs were successful
    all_success = all(r["success"] for r in results.values())
    if all_success:
        print("\n✓ All group data synced successfully!")
        return 0
    else:
        print("\n✗ Some syncs failed. Check errors above.")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
