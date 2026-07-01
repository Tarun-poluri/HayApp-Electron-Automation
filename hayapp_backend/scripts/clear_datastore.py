"""
Script to clear all data from the datastore.

This script clears all reference data, suture packs, and case data from the local databases.

Usage:
    # Activate virtual environment first, then:
    python3.11 scripts/clear_datastore.py [--confirm]

Options:
    --confirm    Skip confirmation prompt (use with caution)
"""

import argparse
import json
import sys
from pathlib import Path

try:
    from tinydb import TinyDB
    from tinydb.middlewares import CachingMiddleware
    from tinydb.storages import JSONStorage
except ImportError:
    print(
        "Error: the 'tinydb' package is required. Install with: pip install tinydb",
        file=sys.stderr,
    )
    print(
        "Or activate the virtual environment: source venv/bin/activate (Linux/Mac) "
        "or venv\\Scripts\\activate (Windows)",
        file=sys.stderr,
    )
    sys.exit(1)

# Add parent directory to path to import hayapp_python modules
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from hayapp_python.common.paths import DATABASE_PATH
except ImportError:
    print(
        "Error: Could not import paths module. Make sure you're running from the "
        "hayapp_backend directory.",
        file=sys.stderr,
    )
    sys.exit(1)


def clear_table(db, table_name):
    """Clear a table and return the count of items cleared."""
    table = db.table(table_name)
    count = len(table)
    table.truncate()
    return count


def clear_tables_in_file(
    db_path: Path,
    table_names: list[str],
    *,
    remove_file_after: bool = False,
) -> dict[str, int | None]:
    """
    Open a TinyDB file, truncate each table, return counts per table.

    If the file is missing or not valid JSON (corrupt / truncated write), remove the
    file when possible and return counts as None for those tables (caller can print
    a corrupt-file notice). remove_file_after=True deletes the file after a
    successful clear (used for reference_data.json).
    """
    empty = {name: 0 for name in table_names}
    if not db_path.exists():
        return empty

    db = None
    try:
        db = TinyDB(str(db_path), storage=CachingMiddleware(JSONStorage))
        counts: dict[str, int | None] = {}
        for name in table_names:
            counts[name] = clear_table(db, name)
        db.close()
        db = None
        if remove_file_after:
            db_path.unlink(missing_ok=True)
        return counts
    except json.JSONDecodeError as e:
        print(
            f"WARNING: Corrupt or incomplete JSON in {db_path} ({e}). Removing file.",
            file=sys.stderr,
        )
        try:
            if db is not None:
                db.close()
        except Exception:
            pass
        db_path.unlink(missing_ok=True)
        return {name: None for name in table_names}
    except (OSError, ValueError) as e:
        print(
            f"WARNING: Could not read {db_path} ({e}). Removing file if present.",
            file=sys.stderr,
        )
        try:
            if db is not None:
                db.close()
        except Exception:
            pass
        db_path.unlink(missing_ok=True)
        return {name: None for name in table_names}


def main():
    """Clear all data from the datastore."""
    parser = argparse.ArgumentParser(description="Clear all data from the datastore.")
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Skip confirmation prompt (use with caution)",
    )

    args = parser.parse_args()

    if not args.confirm:
        print("WARNING: This will clear ALL data from the datastore:")
        print("  - Surgeons")
        print("  - HayApp users (CIR/SCR credentials)")
        print("  - Case types")
        print("  - Suture sheets")
        print("  - Suture packs (needle database)")
        print("  - Case data")
        print("  - Pending adjudications")
        print()
        response = input("Are you sure you want to continue? (yes/no): ").strip().lower()
        if response not in ["yes", "y"]:
            print("Aborted.")
            return 0

    print("Clearing datastore...")
    print("=" * 50)

    results = {}

    # Ensure database directory exists
    DATABASE_PATH.mkdir(parents=True, exist_ok=True)
    (DATABASE_PATH / "cases").mkdir(parents=True, exist_ok=True)

    # Clear reference data database by deleting the file
    reference_db_path = DATABASE_PATH / "reference_data.json"
    ref_tables = ["surgeons", "hayapp_users", "case_types", "sutures", "suture_sheets"]
    ref_counts = clear_tables_in_file(reference_db_path, ref_tables, remove_file_after=True)
    for name in ref_tables:
        results[name] = ref_counts[name]

    # Clear suture pack database (table name matches DataStore: suture_wrappers)
    suture_pack_db_path = DATABASE_PATH / "suture_wrapper_data.json"
    sp_counts = clear_tables_in_file(suture_pack_db_path, ["suture_wrappers"])
    results["suture_packs"] = sp_counts["suture_wrappers"]

    # Clear all case databases
    case_files = list((DATABASE_PATH / "cases").glob("case_data_*.json"))
    total_cases = 0
    total_pendings = 0

    for case_file in case_files:
        c_counts = clear_tables_in_file(case_file, ["case", "pending_adjudication"])
        c = c_counts.get("case")
        p = c_counts.get("pending_adjudication")
        total_cases += c if c is not None else 0
        total_pendings += p if p is not None else 0

    results["cases"] = total_cases
    results["pending_adjudications"] = total_pendings

    def _format_count(count: int | None) -> str:
        if count is None:
            return "removed corrupt file"
        return f"{count} items cleared"

    print("\nCleared Data:")
    print("=" * 50)
    for table_name, count in results.items():
        print(f"  {table_name}: {_format_count(count)}")

    print("=" * 50)
    print("\n✓ Datastore cleared successfully!")
    return 0


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
