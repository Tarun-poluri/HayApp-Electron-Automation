import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field
from tinydb import JSONStorage

from hayapp_python.common.enums import CaseState, HayAppRole

# Use this as the single source of truth for data models in the system/cloud.
# Each class should have to_dict and from_dict methods for easy serialization/deserialization.


@dataclass
class Surgeon:
    surgeon_id: str
    first_name: str
    last_name: str
    suture_sheets: List[str] = field(default_factory=list)

    def to_dict(self):
        return {
            "surgeon_id": self.surgeon_id,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "suture_sheets": self.suture_sheets,
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            surgeon_id=data.get("surgeon_id", ""),
            first_name=data.get("first_name", ""),
            last_name=data.get("last_name", ""),
            suture_sheets=data.get("suture_sheets", []),
        )


@dataclass
class HayAppUser:
    user_id: str
    first_name: str
    last_name: str
    email: str
    password_hash: str
    salt: str
    roles: List[HayAppRole]
    badge: str = ""

    def to_dict(self):
        return {
            "user_id": self.user_id,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "email": self.email,
            "password_hash": self.password_hash,
            "salt": self.salt,
            "roles": [role.value for role in self.roles],
            "badge": self.badge,
        }

    @classmethod
    def from_dict(cls, data):
        roles = [HayAppRole(role) for role in data.get("roles", [])]
        return cls(
            user_id=data["user_id"],
            first_name=data["first_name"],
            last_name=data["last_name"],
            email=data.get("email", ""),
            password_hash=data.get("password_hash", data.get("password", "")),
            salt=data.get("salt", ""),
            roles=roles,
            badge=data.get("badge", ""),
        )


@dataclass
class CaseWorker:
    user_id: str
    role: HayAppRole
    signin: str
    signout: Optional[str] = None

    def to_dict(self):
        return {
            "user_id": self.user_id,
            "role": self.role.value,
            "signin": self.signin,
            "signout": self.signout,
        }

    @classmethod
    def from_dict(cls, data):
        role = HayAppRole(data["role"])
        signin = data.get("signin")
        signout = data.get("signout")
        return cls(user_id=data["user_id"], role=role, signin=signin, signout=signout)


@dataclass
class CaseStaff:
    cir: List[CaseWorker] = field(default_factory=list)
    scr: List[CaseWorker] = field(default_factory=list)
    surgeon: List[Surgeon] = field(default_factory=list)

    def to_dict(self):
        return {
            "cir": [worker.to_dict() for worker in self.cir],
            "scr": [worker.to_dict() for worker in self.scr],
            "surgeon": [sur.to_dict() for sur in self.surgeon],
        }

    @classmethod
    def from_dict(cls, data):
        cir = [CaseWorker.from_dict(w) for w in data.get("cir", [])]
        scr = [CaseWorker.from_dict(w) for w in data.get("scr", [])]
        surgeon = [Surgeon.from_dict(sur) for sur in data.get("surgeon", [])]
        return cls(cir=cir, scr=scr, surgeon=surgeon)


@dataclass
class CaseType:
    name: str
    cpt_code: str
    is_primary: bool
    secondary_cpt_codes: List[str] = field(default_factory=list)

    def to_dict(self):
        return {
            "name": self.name,
            "cpt_code": self.cpt_code,
            "is_primary": self.is_primary,
            "secondary_cpt_codes": self.secondary_cpt_codes,
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            name=data.get("name", ""),
            cpt_code=data.get(
                "cpt_code", data.get("cpt_codes", [""])[0] if data.get("cpt_codes") else ""
            ),
            is_primary=data.get("is_primary", True),
            secondary_cpt_codes=data.get("secondary_cpt_codes", []),
        )


@dataclass
class LoginEvent:
    type: str
    when: str
    who: str
    role: HayAppRole
    password: str

    def to_dict(self):
        return {
            "type": self.type,
            "when": self.when,
            "who": self.who,
            "role": self.role.value if self.role else None,
            "password": self.password,
        }

    @classmethod
    def from_dict(cls, data):
        when = data.get("when")
        role = HayAppRole(data["role"])
        return cls(
            type=data["type"],
            when=when,
            who=data["who"],
            role=role,
            password=data.get("password", ""),
        )


@dataclass
class BadNeedle:
    image: list
    amount: int
    verified: bool

    def to_dict(self):
        return {"image": self.image, "amount": self.amount, "verified": self.verified}

    @classmethod
    def from_dict(cls, data):
        return cls(
            image=data.get("image", []),
            amount=data.get("amount", 0),
            verified=data.get("verified", False),
        )


@dataclass
class SuturePack:
    fda_guid: int
    product_code: str
    needle_name: str
    suture_gauge: str
    manufacturer: str
    num_sutures: int
    num_needles: int
    image: str = ""
    suture_type: str = ""
    suture_length: str = ""
    suture_color: str = ""
    suture_style: str = ""
    needle_type: str = ""
    needle_size: str = ""
    needle_arc: str = ""
    needle_tip: str = ""
    suture_needle_use: List[str] = field(default_factory=list)
    suture_needle_category: str = ""

    def to_dict(self):
        return {
            "fda_guid": self.fda_guid,
            "product_code": self.product_code,
            "needle_name": self.needle_name,
            "suture_gauge": self.suture_gauge,
            "manufacturer": self.manufacturer,
            "num_sutures": self.num_sutures,
            "num_needles": self.num_needles,
            "image": self.image,
            "suture_type": self.suture_type,
            "suture_length": self.suture_length,
            "suture_color": self.suture_color,
            "suture_style": self.suture_style,
            "needle_type": self.needle_type,
            "needle_size": self.needle_size,
            "needle_arc": self.needle_arc,
            "needle_tip": self.needle_tip,
            "suture_needle_use": self.suture_needle_use,
            "suture_needle_category": self.suture_needle_category,
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            fda_guid=data["fda_guid"],
            product_code=data["product_code"],
            needle_name=data["needle_name"],
            suture_gauge=data.get("suture_gauge", data.get("suture_size", "")),
            manufacturer=data["manufacturer"],
            num_sutures=data["num_sutures"],
            num_needles=data["num_needles"],
            image=data.get("image", ""),
            suture_type=data.get("suture_type", ""),
            suture_length=data.get("suture_length", ""),
            suture_color=data.get("suture_color", ""),
            suture_style=data.get("suture_style", ""),
            needle_type=data.get("needle_type", ""),
            needle_size=data.get("needle_size", ""),
            needle_arc=data.get("needle_arc", ""),
            needle_tip=data.get("needle_tip", ""),
            suture_needle_use=data.get("suture_needle_use", ""),
            suture_needle_category=data.get("suture_needle_category", ""),
        )


@dataclass
class CaseSuture:
    fda_guid: int
    num_packs: int
    product_code: str
    nomenclature: str  # Pre-formatted: "3-0 PROLENE SH"
    needles_per_pack: int
    suture_needle_use: List[str]  # Array of suture needle uses
    suture_needle_category: str

    def to_dict(self):
        return {
            "fda_guid": self.fda_guid,
            "num_packs": self.num_packs,
            "product_code": self.product_code,
            "nomenclature": self.nomenclature,
            "needles_per_pack": self.needles_per_pack,
            "suture_needle_use": self.suture_needle_use,
            "suture_needle_category": self.suture_needle_category,
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            fda_guid=data["fda_guid"],
            num_packs=data["num_packs"],
            product_code=data["product_code"],
            nomenclature=data["nomenclature"],
            needles_per_pack=data["needles_per_pack"],
            suture_needle_use=data["suture_needle_use"],
            suture_needle_category=data["suture_needle_category"],
        )


@dataclass
class SutureSheetItem:
    fda_gudid: int
    suture_needle_use: List[str]  # Array of suture needle uses
    suture_needle_category: str
    num_packs: int

    def to_dict(self):
        return {
            "fda_gudid": self.fda_gudid,
            "suture_needle_use": self.suture_needle_use,
            "suture_needle_category": self.suture_needle_category,
            "num_packs": self.num_packs,
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            fda_gudid=data.get("fda_gudid", 0),
            suture_needle_use=data.get("suture_needle_use", ""),
            suture_needle_category=data.get("suture_needle_category", ""),
            num_packs=data.get("num_packs", 0),
        )


@dataclass
class SutureSheet:
    suture_sheet_id: str
    surgeon_id: str
    cpt_codes: List[str]
    suture_sheet_items: List[SutureSheetItem]

    def to_dict(self):
        result = {
            "suture_sheet_id": self.suture_sheet_id,
            "surgeon_id": self.surgeon_id,
            "cpt_codes": self.cpt_codes,
            "suture_sheet_items": [ssi.to_dict() for ssi in self.suture_sheet_items],
        }
        return result

    @classmethod
    def from_dict(cls, data):
        return cls(
            suture_sheet_id=data["suture_sheet_id"],
            surgeon_id=data["surgeon_id"],
            cpt_codes=data.get("cpt_codes", []),
            suture_sheet_items=[
                SutureSheetItem.from_dict(ssi) for ssi in data.get("suture_sheet_items", [])
            ],
        )


@dataclass
class InterimCount:
    when: str
    cir_id: str
    scr_id: str
    remaining_count: int
    bad_needles_count: int
    verified: bool

    def to_dict(self):
        return {
            "when": self.when,
            "cir_id": self.cir_id,
            "scr_id": self.scr_id,
            "remaining_count": self.remaining_count,
            "bad_needles_count": self.bad_needles_count,
            "verified": self.verified,
        }

    @classmethod
    def from_dict(cls, data):
        when = data.get("when")
        return cls(
            when=when,
            cir_id=data.get("cir_id", ""),
            scr_id=data.get("scr_id", ""),
            remaining_count=data.get("remaining_count", 0),
            bad_needles_count=data.get("bad_needles_count", 0),
            verified=data.get("verified", False),
        )


@dataclass
class ReliefCount:
    when: str
    cir: str
    scr: str
    remaining_count: int
    bad_needles_count: int
    misplaced_count: int
    remaining_verified: bool
    bad_needles_verified: bool
    total_needles_verified: bool
    relief_count_verified: bool
    cir_replaced: bool
    scr_replaced: bool
    cir_replacement_id: str = ""
    scr_replacement_id: str = ""

    def to_dict(self):
        return {
            "when": self.when,
            "cir": self.cir,
            "scr": self.scr,
            "remaining_count": self.remaining_count,
            "bad_needles_count": self.bad_needles_count,
            "misplaced_count": self.misplaced_count,
            "remaining_verified": self.remaining_verified,
            "bad_needles_verified": self.bad_needles_verified,
            "total_needles_verified": self.total_needles_verified,
            "relief_count_verified": self.relief_count_verified,
            "cir_replaced": self.cir_replaced,
            "scr_replaced": self.scr_replaced,
            "cir_replacement_id": self.cir_replacement_id,
            "scr_replacement_id": self.scr_replacement_id,
        }

    @classmethod
    def from_dict(cls, data):
        when = data.get("when")
        return cls(
            when=when,
            cir=data.get("cir", ""),
            scr=data.get("scr", ""),
            remaining_count=data.get("remaining_count", 0),
            bad_needles_count=data.get("bad_needles_count", 0),
            misplaced_count=data.get("misplaced_count", 0),
            remaining_verified=data.get("remaining_verified", False),
            bad_needles_verified=data.get("bad_needles_verified", False),
            total_needles_verified=data.get("total_needles_verified", False),
            relief_count_verified=data.get("relief_count_verified", False),
            cir_replaced=data.get("cir_replaced", False),
            scr_replaced=data.get("scr_replaced", False),
            cir_replacement_id=data.get("cir_replacement_id", ""),
            scr_replacement_id=data.get("scr_replacement_id", ""),
        )


@dataclass
class ClosingCount:
    when: str
    cir_id: str
    scr_id: str
    remaining_count: int
    bad_needles_count: int
    all_loose_sutures_desposited: bool
    unused_sutures_deposited: bool
    amount_closing_sutures_added: int
    closing_sutures: List["CaseSuture"] = field(default_factory=list)

    def to_dict(self):
        return {
            "when": self.when,
            "cir_id": self.cir_id,
            "scr_id": self.scr_id,
            "remaining_count": self.remaining_count,
            "bad_needles_count": self.bad_needles_count,
            "all_loose_sutures_desposited": self.all_loose_sutures_desposited,
            "unused_sutures_deposited": self.unused_sutures_deposited,
            "amount_closing_sutures_added": self.amount_closing_sutures_added,
            "closing_sutures": [cs.to_dict() for cs in self.closing_sutures],
        }

    @classmethod
    def from_dict(cls, data):
        when = data.get("when")
        return cls(
            when=when,
            cir_id=data.get("cir_id", ""),
            scr_id=data.get("scr_id", ""),
            remaining_count=data.get("remaining_count", 0),
            bad_needles_count=data.get("bad_needles_count", 0),
            all_loose_sutures_desposited=data.get("all_loose_sutures_desposited", False),
            unused_sutures_deposited=data.get("unused_sutures_deposited", False),
            amount_closing_sutures_added=data.get("amount_closing_sutures_added", 0),
            closing_sutures=[CaseSuture.from_dict(cs) for cs in data.get("closing_sutures", [])],
        )


@dataclass
class AdjudicatedImage:
    image: str
    one_complete_suture: bool
    timestamp: str
    reason: str = ""
    description: str = ""

    def to_dict(self):
        return {
            "image": self.image,
            "one_complete_suture": self.one_complete_suture,
            "timestamp": self.timestamp,
            "reason": self.reason,
            "description": self.description,
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            image=data["image"],
            one_complete_suture=data["one_complete_suture"],
            timestamp=data["timestamp"],
            reason=data.get("reason", ""),
            description=data.get("description", ""),
        )


@dataclass
class CBINeedles:
    type: str
    count: int
    image: str

    def to_dict(self):
        return {
            "type": self.type,
            "count": self.count,
            "image": self.image,
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            type=data["type"],
            count=data["count"],
            image=data["image"],
        )


@dataclass
class Case:
    case_id: int = 0
    staff: CaseStaff = field(default_factory=CaseStaff)
    state: CaseState = CaseState.NotStarted
    case_types: List[CaseType] = field(default_factory=list)
    bad_needles: List[BadNeedle] = field(default_factory=list)
    interim_counts: List[InterimCount] = field(default_factory=list)
    relief_counts: List[ReliefCount] = field(default_factory=list)
    case_sutures: List[CaseSuture] = field(default_factory=list)
    login_events: List[LoginEvent] = field(default_factory=list)
    adjudicated_images: List[AdjudicatedImage] = field(default_factory=list)
    closing_counts: List[ClosingCount] = field(default_factory=list)
    added_needles: List[SuturePack] = field(default_factory=list)
    cbi_needles: List[CBINeedles] = field(default_factory=list)
    cbi_contaminated_needle_count: int = 0
    cbi_incompatible_needle_count: int = 0
    cbi_broken_needle_count: int = 0

    def to_dict(self):
        return {
            "case_id": self.case_id,
            "staff": self.staff.to_dict(),
            "state": self.state.value,
            "case_types": [ct.to_dict() for ct in self.case_types],
            "bad_needles": [bn.to_dict() for bn in self.bad_needles],
            "interim_counts": [ic.to_dict() for ic in self.interim_counts],
            "relief_counts": [rc.to_dict() for rc in self.relief_counts],
            "case_sutures": [cs.to_dict() for cs in self.case_sutures],
            "login_events": [le.to_dict() for le in self.login_events],
            "adjudicated_images": [ai.to_dict() for ai in self.adjudicated_images],
            "closing_counts": [cc.to_dict() for cc in self.closing_counts],
            "added_needles": [an.to_dict() for an in self.added_needles],
            "cbi_needles": [cn.to_dict() for cn in self.cbi_needles],
            "cbi_contaminated_needle_count": self.cbi_contaminated_needle_count,
            "cbi_incompatible_needle_count": self.cbi_incompatible_needle_count,
            "cbi_broken_needle_count": self.cbi_broken_needle_count,
        }

    @classmethod
    def from_dict(cls, data):
        staff = CaseStaff.from_dict(data["staff"])
        state = CaseState(data.get("state") or data.get("state"))
        case_types = [CaseType.from_dict(ct) for ct in data.get("case_types", [])]
        bad_needles = [BadNeedle.from_dict(bn) for bn in data.get("bad_needles", [])]
        interim_counts = [InterimCount.from_dict(ic) for ic in data.get("interim_counts", [])]
        relief_counts = [ReliefCount.from_dict(rc) for rc in data.get("relief_counts", [])]
        case_sutures = [CaseSuture.from_dict(cs) for cs in data.get("case_sutures", [])]
        login_events = [LoginEvent.from_dict(le) for le in data.get("login_events", [])]
        adjudicated_images = [
            AdjudicatedImage.from_dict(ai) for ai in data.get("adjudicated_images", [])
        ]
        closing_counts = [ClosingCount.from_dict(cc) for cc in data.get("closing_counts", [])]
        added_needles = [SuturePack.from_dict(an) for an in data.get("added_needles", [])]
        cbi_needles = [CBINeedles.from_dict(cn) for cn in data.get("cbi_needles", [])]
        cbi_contaminated_needle_count = data.get("cbi_contaminated_needle_count", 0)
        cbi_incompatible_needle_count = data.get("cbi_incompatible_needle_count", 0)
        cbi_broken_needle_count = data.get("cbi_broken_needle_count", 0)

        return cls(
            case_id=data["case_id"],
            staff=staff,
            state=state,
            case_types=case_types,
            bad_needles=bad_needles,
            interim_counts=interim_counts,
            relief_counts=relief_counts,
            case_sutures=case_sutures,
            login_events=login_events,
            adjudicated_images=adjudicated_images,
            closing_counts=closing_counts,
            added_needles=added_needles,
            cbi_needles=cbi_needles,
            cbi_contaminated_needle_count=cbi_contaminated_needle_count,
            cbi_incompatible_needle_count=cbi_incompatible_needle_count,
            cbi_broken_needle_count=cbi_broken_needle_count,
        )


class PrettyJSONStorage(JSONStorage):
    def write(self, data):
        # Write JSON with indentation for readability
        self._handle.seek(0)
        json.dump(data, self._handle, indent=4)
        self._handle.truncate()


class FileUploadData(BaseModel):
    filepath: Path
    content_type: str
    extra_form_fields: Optional[dict] = None  # Additional form fields if needed
    delete_after_upload: bool = True


class JsonUploadData(BaseModel):
    body: dict  # Json serializable dictionary


class UploadItem(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    method: str
    endpoint: str
    data: FileUploadData | JsonUploadData
    query_params: Optional[dict] = None
    last_error: Optional[str] = None  # Helpful to see in the database for a quick check
    created_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
