import datetime

from hayapp_python.version import VERSION

# 1. Configuration
APP_NAME = "HayAppBroker"
COMPANY = "Magvation"
COPYRIGHT = f"© {datetime.datetime.now().year} {COMPANY}. All rights reserved."

# 2. Generate Windows Metadata (as done before)
v_parts = VERSION.split(".")
v_tuple = tuple(int(v_parts[i]) if i < len(v_parts) else 0 for i in range(4))

metadata_content = f"""
VSVersionInfo(
  ffi=FixedFileInfo(
    filevers={v_tuple}, prodvers={v_tuple},
    mask=0x3f, flags=0x0, OS=0x40004, fileType=0x1, subtype=0x0, date=(0, 0)
  ),
  kids=[
    StringFileInfo([
      StringTable(u'040904B0', [
        StringStruct(u'CompanyName', u'{COMPANY}'),
        StringStruct(u'FileDescription', u'HayApp Broker'),
        StringStruct(u'FileVersion', u'{VERSION}'),
        StringStruct(u'InternalName', u'hayapp_broker'),
        StringStruct(u'LegalCopyright', u'{COPYRIGHT}'),
        StringStruct(u'OriginalFilename', u'{APP_NAME}.exe'),
        StringStruct(u'ProductName', u'{APP_NAME}'),
        StringStruct(u'ProductVersion', u'{VERSION}')
      ])
    ]),
    VarFileInfo([VarStruct(u'Translation', [1033, 1200])])
  ]
)
"""

with open("version_meta.txt", "w", encoding="utf-8") as f:
    f.write(metadata_content)
