from typing import NamedTuple

import keyring

# Placeholder if not found to facilitate testing
API_KEY = keyring.get_password("hayapp", "api_key") or "PleaseProvisionAPIKey"
GROUP_ID = keyring.get_password("hayapp", "group_id") or "PleaseProvisionGroupID"


class EndpointConstants(NamedTuple):
    HAYAPP_USERS: str
    SURGEONS: str
    NEEDLES_DATABASE: str
    NEEDLES_IMAGES: str
    LOG_FILES: str
    CASE_REPORTS: str
    CASE_TYPES: str
    SUTURE_SHEETS: str


ENDPOINTS = EndpointConstants(
    HAYAPP_USERS="users/hayapp-users",
    SURGEONS="surgeons/",
    NEEDLES_DATABASE="needles/database/latest",
    NEEDLES_IMAGES="needles/images/latest",
    LOG_FILES="log_files/",
    CASE_REPORTS="case_reports/",
    CASE_TYPES="case-types/",
    SUTURE_SHEETS="suture-sheets/",
)
