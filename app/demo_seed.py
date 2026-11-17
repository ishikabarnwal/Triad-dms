"""Demo data for screenshots, the demo video and the live deployment.

Run with: docker compose exec backend python -m app.demo_seed --reset

Every step goes through the real API in-process (Flask's test client), so uploads are stored in
GridFS, read by OCR and audited exactly like a real upload. After each step the records it wrote
are moved back in time, so the dashboard, activity feed and audit log show three weeks of work
instead of everything happening "just now".

--reset first removes documents, stored files, access requests, audit logs and every user except
admins. Divisions, metadata fields and admin accounts are never touched. Without --reset the seed
refuses to run on a database that already has documents.
"""

import argparse
import io
import json
import random
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone

import fitz
from PIL import Image, ImageFilter

from app.models import parse_object_id

DEMO_PASSWORD = "Demo@12345"
IST = timezone(timedelta(hours=5, minutes=30))

USERS = {
    "asha": {"name": "Asha Verma", "email": "asha.verma@example.com", "username": "asha", "division": "Division A"},
    "ravi": {"name": "Ravi Menon", "email": "ravi.menon@example.com", "username": "ravi", "division": "Division A"},
    "meera": {"name": "Meera Rao", "email": "meera.rao@example.com", "username": "meera", "division": "Division B"},
    "arjun": {"name": "Arjun Singh", "email": "arjun.singh@example.com", "username": "arjun", "division": "Division B"},
}

# Each document: who uploads it and when (days ago, IST time), its metadata, its format, and its
# pages as (heading, paragraphs). Scans are rendered to an image and roughened so OCR has real work.
DOCUMENTS = [
    {
        "key": "fleet",
        "title": "Fleet Maintenance Report Q3",
        "uploader": "asha",
        "when": (20, "10:05"),
        "metadata": {"Report Type": "Technical", "Classification": "RESTRICTED", "Document Date": "2026-10-28", "Reference Number": "TEC/2610/412"},
        "format": "pdf",
        "pages": [
            ("Summary", [
                "This report covers scheduled and unscheduled maintenance carried out on the Division A transport fleet between July and September 2026.",
                "Of 64 vehicles on strength, 58 completed their quarterly service on time. Six were deferred because of spare part shortages, listed in section 3.",
                "Engine hours rose by 11 percent against the previous quarter, driven by the northern sector convoy runs in August.",
            ]),
            ("Service record", [
                "Light vehicles: 31 serviced, 2 deferred. Brake pad replacement was the most common repair, followed by suspension bushes.",
                "Heavy vehicles: 27 serviced, 4 deferred. Two tankers need new fuel pumps before the winter cycle.",
                "Recovery vehicles: both units passed inspection. Winch cables on unit RV-2 were replaced as a precaution.",
            ]),
            ("Deferred work and actions", [
                "The six deferred vehicles are parked at Depot 3 pending delivery of filters and pump assemblies ordered on 14 October.",
                "Workshop capacity should be raised for November by moving two fitters from the general pool.",
                "Prepared by the Division A motor transport officer for the joint maintenance audit.",
            ]),
        ],
    },
    {
        "key": "convoy",
        "title": "Convoy Movement Plan, Northern Sector",
        "uploader": "ravi",
        "when": (18, "09:40"),
        "metadata": {"Report Type": "Operational", "Classification": "SECRET", "Document Date": "2026-11-02", "Reference Number": "OPS/2611/044"},
        "format": "pdf",
        "pages": [
            ("Purpose", [
                "This plan sets out the movement of the winter stores convoy from the base depot to the northern sector forward posts.",
                "The convoy leaves the northern depot in three serials, two hours apart, to keep the mountain road clear for civilian traffic.",
            ]),
            ("Route and timings", [
                "Serial 1 departs at 0500 hours with fuel and rations. Serial 2 departs at 0700 hours with engineering stores. Serial 3 departs at 0900 hours with medical supplies and the recovery vehicle.",
                "Halts are planned at the river crossing and at kilometre 84. Each halt lasts no more than 30 minutes.",
                "If the pass is closed by snow, serials hold at the transit camp and report to the movement control cell.",
            ]),
            ("Communications and escort", [
                "Each serial carries two radio sets on the convoy net. Check-ins are due every 45 minutes.",
                "Coastal escort coordination with Division B is required for the first leg along the shore road.",
            ]),
        ],
    },
    {
        "key": "spares",
        "title": "Spare Parts Inventory, October 2026",
        "uploader": "ravi",
        "when": (16, "15:20"),
        "metadata": {"Report Type": "Administrative", "Classification": "RESTRICTED", "Document Date": "2026-10-31", "Reference Number": "ADM/2610/233"},
        "format": "pdf",
        "pages": [
            ("Stock position", [
                "Oil filters: 142 in stock, minimum level 100. Air filters: 88 in stock, minimum level 120, reorder raised.",
                "Fuel pump assemblies: 3 in stock, 6 on order. Brake pad sets: 210 in stock.",
                "Batteries 12V heavy duty: 46 in stock. Twelve were issued to the northern sector in October.",
            ]),
            ("Shared spares", [
                "Hydraulic seals and fittings are held jointly with the Division B sonar laboratory and issued on request.",
                "The shared stock will move to the new depot inventory system in December.",
            ]),
        ],
    },
    {
        "key": "fuel",
        "title": "Fuel Consumption Statement Q2",
        "uploader": "asha",
        "when": (14, "11:30"),
        "metadata": {"Report Type": "Financial", "Classification": "CONFIDENTIAL", "Document Date": "2026-10-15", "Reference Number": "FIN/2610/118"},
        "format": "pdf",
        "pages": [
            ("Overview", [
                "Diesel consumption for the second quarter was 412,000 litres against an allocation of 430,000 litres.",
                "Petrol consumption was 38,500 litres, within the allocation of 40,000 litres.",
            ]),
            ("By activity", [
                "Convoy operations used 61 percent of diesel, training 22 percent and administrative movement 17 percent.",
                "Generator fuel at forward posts rose in June because of extended power cuts.",
                "Figures are provisional until the fuel audit closes at the end of November.",
            ]),
        ],
    },
    {
        "key": "inspection",
        "title": "Vehicle Inspection Sheet, Depot 3",
        "uploader": "asha",
        "when": (12, "16:45"),
        "metadata": {"Report Type": "Technical", "Classification": "RESTRICTED", "Document Date": "2026-11-05", "Reference Number": "TEC/2611/127"},
        "format": "jpg",
        "pages": [
            ("VEHICLE INSPECTION SHEET", [
                "Depot 3, inspection of deferred vehicles",
                "Tanker TK-14: fuel pump leaking, keep off the road",
                "Tanker TK-19: fuel pump worn, replace before winter",
                "Truck HV-07: rear axle seal, repaired on site",
                "Inspected by Asha Verma, Division A",
            ]),
        ],
    },
    {
        "key": "recce",
        "title": "Route Reconnaissance Notes, River Crossing",
        "uploader": "ravi",
        "when": (9, "12:10"),
        "metadata": {"Report Type": "Operational", "Classification": "CONFIDENTIAL", "Document Date": "2026-11-08", "Reference Number": "OPS/2611/061"},
        "format": "png",
        "pages": [
            ("ROUTE RECONNAISSANCE NOTES", [
                "River crossing at kilometre 52",
                "Bridge load limit 40 tonnes, heavy vehicles cross one at a time",
                "Diversion through the village road is too narrow for tankers",
                "Snow chains needed beyond the pass from December",
                "Recorded by Ravi Menon, Division A",
            ]),
        ],
    },
    {
        "key": "radar",
        "title": "Radar Calibration Log, Station 7",
        "uploader": "meera",
        "when": (19, "11:15"),
        "metadata": {"Report Type": "Technical", "Classification": "CONFIDENTIAL", "Document Date": "2026-10-30", "Reference Number": "TEC/2610/388"},
        "format": "pdf",
        "pages": [
            ("Calibration summary", [
                "Station 7 surface search radar was calibrated on 29 and 30 October after the antenna bearing replacement.",
                "Range error after calibration is within 15 metres at 40 kilometres. Bearing error is within 0.3 degrees.",
            ]),
            ("Measurements", [
                "Reference target 1 at 12.0 km: measured 12.01 km. Reference target 2 at 27.5 km: measured 27.49 km.",
                "Reference target 3 at 40.0 km: measured 40.02 km. Sea clutter suppression set to level 4 for winter conditions.",
            ]),
            ("Next steps", [
                "Recheck alignment before the convoy exercise along the shore road.",
                "Next full calibration is due in April 2027.",
            ]),
        ],
    },
    {
        "key": "coastal",
        "title": "Coastal Surveillance Summary, Week 45",
        "uploader": "arjun",
        "when": (17, "18:05"),
        "metadata": {"Report Type": "Intelligence", "Classification": "SECRET", "Document Date": "2026-11-09", "Reference Number": "INT/2611/019"},
        "format": "pdf",
        "pages": [
            ("Overview", [
                "This summary covers coastal surveillance from 2 to 8 November 2026 along the eastern shore sector.",
                "Fishing traffic was normal for the season. Two unidentified small craft were tracked near the river mouth and later identified as local trawlers.",
            ]),
            ("Coverage", [
                "Radar coverage was continuous except for a four hour gap at Station 7 during calibration.",
                "Shore patrols covered 96 percent of planned routes. Weather stopped two night patrols.",
            ]),
        ],
    },
    {
        "key": "sonar",
        "title": "Sonar Array Test Results",
        "uploader": "meera",
        "when": (11, "14:35"),
        "metadata": {"Report Type": "Technical", "Classification": "RESTRICTED", "Document Date": "2026-11-06", "Reference Number": "TEC/2611/144"},
        "format": "pdf",
        "pages": [
            ("Test setup", [
                "The towed sonar array was tested in the harbour test range over three days with the calibrated sound source.",
                "Water temperature ranged from 24 to 26 degrees. Sea state was 2 throughout.",
            ]),
            ("Results", [
                "Detection range against the reference source met the specification at all three frequencies.",
                "Element 14 showed higher noise and was replaced. Hydraulic seals on the winch need spares from the shared stock.",
            ]),
        ],
    },
    {
        "key": "training",
        "title": "Training Schedule Winter Batch",
        "uploader": "arjun",
        "when": (15, "10:50"),
        "metadata": {"Report Type": "Administrative", "Classification": "UNCLASSIFIED", "Document Date": "2026-11-03", "Reference Number": "ADM/2611/011"},
        "format": "pdf",
        "pages": [
            ("Courses", [
                "Winter batch runs from 1 December 2026 to 28 February 2027 at the technical training wing.",
                "Courses: radar operator basic (6 weeks), sonar maintenance (8 weeks), cold weather driving (2 weeks).",
            ]),
            ("Nominations", [
                "Divisions send nominations by 20 November. Cold weather driving is open to drivers from every division.",
                "Joining instructions will be issued one week before each course starts.",
            ]),
        ],
    },
    {
        "key": "purchase",
        "title": "Lab Equipment Purchase Order",
        "uploader": "meera",
        "when": (6, "17:25"),
        "metadata": {"Report Type": "Financial", "Classification": "RESTRICTED", "Document Date": "2026-11-11", "Reference Number": "FIN/2611/076"},
        "format": "jpg",
        "pages": [
            ("PURCHASE ORDER", [
                "Sonar laboratory, Division B",
                "Item 1: hydrophone test kit, quantity 2",
                "Item 2: signal analyser, quantity 1",
                "Item 3: hydraulic seal set, quantity 10",
                "Approved by Meera Rao",
            ]),
        ],
    },
    {
        "key": "budget",
        "title": "Annual Budget Allocation FY 2026-27",
        "uploader": "admin",
        "when": (21, "09:15"),
        "metadata": {"Report Type": "Financial", "Classification": "CONFIDENTIAL", "Document Date": "2026-10-20", "Reference Number": "FIN/2610/001"},
        "format": "pdf",
        "pages": [
            ("Allocation", [
                "This note sets the budget allocation for financial year 2026-27 across the divisions under this headquarters.",
                "Division A receives 46 percent, mainly for transport, fuel and convoy operations. Division B receives 38 percent for surveillance, radar and sonar work.",
                "Headquarters keeps 16 percent for training, communications security and contingencies.",
            ]),
            ("Capital items", [
                "Two replacement tankers and one recovery vehicle for Division A.",
                "Radar antenna spares and a second towed sonar array for Division B.",
            ]),
            ("Controls", [
                "Divisions report spending monthly. Any reallocation above five percent needs headquarters approval.",
            ]),
            ("Review", [
                "The allocation will be reviewed at the quarterly readiness review in January 2027.",
            ]),
        ],
    },
    {
        "key": "comsec",
        "title": "Communications Security Directive 14/2026",
        "uploader": "admin",
        "when": (13, "13:00"),
        "metadata": {"Report Type": "Administrative", "Classification": "SECRET", "Document Date": "2026-11-04", "Reference Number": "ADM/2611/014"},
        "format": "pdf",
        "pages": [
            ("Directive", [
                "With effect from 15 November 2026, all convoy and patrol nets change keys every 24 hours.",
                "Key change takes place at 0001 hours. Stations that miss a change report to the signals officer at once.",
            ]),
            ("Handling", [
                "Key material is stored in the station safe and signed for on every issue.",
                "Loss or suspected compromise is reported within one hour.",
            ]),
        ],
    },
    {
        "key": "readiness",
        "title": "Quarterly Readiness Review",
        "uploader": "admin",
        "when": (3, "16:00"),
        "metadata": {"Report Type": "Operational", "Classification": "CONFIDENTIAL", "Document Date": "2026-11-14", "Reference Number": "OPS/2611/100"},
        "format": "pdf",
        "pages": [
            ("Overall readiness", [
                "Both divisions are assessed as ready for winter operations, with two actions open.",
                "Division A must clear the six deferred vehicles at Depot 3 before the second winter convoy.",
            ]),
            ("Division B", [
                "Station 7 radar is back to full coverage after calibration. Sonar trials are on schedule.",
            ]),
            ("Actions", [
                "Fuel audit to close by 30 November. Winter batch nominations to reach the training wing by 20 November.",
            ]),
        ],
    },
]

# Access requests: who asks for which document and why, and what happens to it afterwards.
REQUESTS = [
    {"by": "meera", "doc": "fleet", "when": (1, "11:20"), "reason": "Joint maintenance audit, week 47"},
    {"by": "asha", "doc": "radar", "when": (0, "hours:3"), "reason": "Cross checking radar alignment before the convoy exercise"},
    {
        "by": "arjun", "doc": "convoy", "when": (6, "10:10"), "reason": "Coordinating the coastal escort for the northern convoy",
        "decide": {"by": "ravi", "action": "approve", "days": 30, "when": (5, "09:30"), "note": "Approved for escort planning."},
    },
    {
        "by": "ravi", "doc": "training", "when": (10, "12:30"), "reason": "Nominating Division A drivers for the winter batch",
        "decide": {"by": "meera", "action": "approve", "days": None, "when": (9, "15:05")},
    },
    {
        "by": "arjun", "doc": "fuel", "when": (9, "11:40"), "reason": "Comparing fuel use for the sonar trials budget",
        "decide": {"by": "asha", "action": "reject", "when": (8, "10:20"), "note": "Fuel figures are still being audited. Ask again after 30 November."},
    },
    {
        "by": "meera", "doc": "spares", "when": (12, "09:55"), "reason": "Checking shared hydraulic spares for the sonar lab",
        "decide": {"by": "ravi", "action": "approve", "days": 30, "when": (11, "16:30")},
        "reads": [{"by": "meera", "kind": "preview", "when": (10, "11:00")}],
        "revoke": {"by": "asha", "when": (4, "14:15"), "note": "Inventory moved to the new depot system."},
    },
    {
        "by": "ravi", "doc": "coastal", "when": (15, "15:45"), "reason": "Route planning for the coastal convoy leg",
        "decide": {"by": "arjun", "action": "approve", "days": 7, "when": (14, "10:00")},
    },
]


class DemoSeedRefused(Exception):
    """The database already has documents and --reset wasn't given."""


# ---- file builders ----

def _write_page(document, heading, paragraphs, meta_lines):
    """One A4 page: classification banner, title block on the first page, then the section text."""
    page = document.new_page(width=595, height=842)
    banner = meta_lines["classification"]
    left = (page.rect.width - fitz.get_text_length(banner, fontname="hebo", fontsize=9)) / 2
    page.insert_text((left, 36), banner, fontsize=9, fontname="hebo")
    page.insert_text((left, 818), banner, fontsize=9, fontname="hebo")
    y = 80
    if document.page_count == 1:
        page.insert_text((60, y), meta_lines["title"], fontsize=17, fontname="hebo")
        y += 24
        for line in meta_lines["details"]:
            page.insert_text((60, y), line, fontsize=9.5, fontname="helv", color=(0.35, 0.35, 0.45))
            y += 15
        y += 18
    page.insert_text((60, y), heading, fontsize=12.5, fontname="hebo")
    y += 10
    page.insert_textbox(fitz.Rect(60, y, 535, 790), "\n\n".join(paragraphs), fontsize=10.5, fontname="helv", lineheight=1.45)


def build_pdf(spec, division):
    """A multi-page PDF with a real text layer."""
    meta = spec["metadata"]
    meta_lines = {
        "classification": meta["Classification"],
        "title": spec["title"],
        "details": [
            f"Reference {meta['Reference Number']}  |  {division}  |  Dated {meta['Document Date']}",
            f"Report type: {meta['Report Type']}",
        ],
    }
    document = fitz.open()
    for heading, paragraphs in spec["pages"]:
        _write_page(document, heading, paragraphs, meta_lines)
    data = document.tobytes(garbage=3, deflate=True)
    document.close()
    return data


def build_scan(spec, rng):
    """A page of large typed text rendered to an image, tilted slightly and roughened like a scan."""
    heading, lines = spec["pages"][0]
    document = fitz.open()
    page = document.new_page(width=595, height=842)
    page.insert_text((60, 90), heading, fontsize=20, fontname="hebo")
    y = 140
    for line in lines:
        page.insert_text((60, y), line, fontsize=14, fontname="helv")
        y += 32
    pixmap = page.get_pixmap(dpi=150, colorspace=fitz.csGRAY)
    document.close()

    image = Image.frombytes("L", (pixmap.width, pixmap.height), pixmap.samples)
    image = image.rotate(rng.uniform(-1.4, 1.4), resample=Image.Resampling.BICUBIC, expand=False, fillcolor=255)
    noise = Image.effect_noise(image.size, 28)
    image = Image.blend(image, noise, 0.07).filter(ImageFilter.GaussianBlur(0.5))
    # Slightly grey paper rather than pure white.
    image = image.point(lambda value: min(value, 238))

    buffer = io.BytesIO()
    if spec["format"] == "jpg":
        image.convert("RGB").save(buffer, format="JPEG", quality=80)
    else:
        image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


# ---- the seeding run ----

class DemoSeeder:
    """Drives the API through a test client and backdates each step to its place on the timeline."""

    def __init__(self, app):
        self.app = app
        self.db = app.extensions["mongo_db"]
        self.client = app.test_client()
        self.now = datetime.now(timezone.utc)
        self.tokens = {}
        self.user_ids = {}
        self.documents = {}
        self.rng = random.Random(2026)
        self.offset = 0

    # -- time --

    def at(self, when):
        """UTC time for (days ago, "HH:MM" in IST), or (0, "hours:N") for N hours ago."""
        days, clock = when
        if clock.startswith("hours:"):
            return self.now - timedelta(hours=int(clock.split(":")[1]))
        hour, minute = (int(part) for part in clock.split(":"))
        local = (self.now.astimezone(IST) - timedelta(days=days)).replace(hour=hour, minute=minute, second=0, microsecond=0)
        return min(local.astimezone(timezone.utc), self.now - timedelta(minutes=30))

    def step(self, when, action):
        """Run one API call, then move the audit entries it wrote to `when` (plus a few seconds,
        so entries from the same minute keep their order)."""
        # Mongo keeps milliseconds only, so start a little early to catch entries from this same millisecond.
        started = datetime.now(timezone.utc) - timedelta(milliseconds=5)
        result = action()
        self.offset += 7
        stamp = when + timedelta(seconds=self.offset % 50)
        self.db.audit_logs.update_many({"created_at": {"$gte": started}}, {"$set": {"created_at": stamp}})
        return result, stamp

    def call(self, method, path, who=None, **kwargs):
        """One API call; fails loudly so a broken demo never looks complete."""
        headers = {"Authorization": f"Bearer {self.tokens[who]}"} if who else {}
        response = getattr(self.client, method)(f"/api{path}", headers=headers, **kwargs)
        if response.status_code >= 400:
            raise RuntimeError(f"{method.upper()} {path} failed with {response.status_code}: {response.get_json()}")
        return response

    # -- people --

    def admin_sign_in(self, when):
        """Sign the configured super admin in."""
        config = self.app.config
        body = {"email": config["ADMIN_EMAIL"], "password": config["ADMIN_PASSWORD"]}
        response, _ = self.step(when, lambda: self.call("post", "/auth/login", json=body))
        self.tokens["admin"] = response.get_json()["token"]

    def register(self, key, when):
        """Create a demo user through the sign up endpoint."""
        user = USERS[key]
        body = {**user, "password": DEMO_PASSWORD}
        response, stamp = self.step(when, lambda: self.call("post", "/auth/register", json=body))
        payload = response.get_json()
        self.tokens[key] = payload["token"]
        self.user_ids[key] = payload["user"]["id"]
        self.db.users.update_one({"email": user["email"]}, {"$set": {"created_at": stamp}})

    def sign_in(self, key, when, password=DEMO_PASSWORD):
        """A sign in (or a failed one, with the wrong password) at a point in the past."""
        body = {"email": USERS[key]["email"], "password": password}

        def login():
            return self.client.post("/api/auth/login", json=body)

        response, stamp = self.step(when, login)
        if response.status_code == 200:
            self.db.users.update_one({"email": USERS[key]["email"]}, {"$set": {"last_login_at": stamp}})

    # -- documents --

    def upload(self, spec):
        """Upload one document through the real endpoint, then date it."""
        uploader = spec["uploader"]
        division = USERS[uploader]["division"] if uploader != "admin" else self.app.config["ADMIN_DIVISION"]
        if spec["format"] == "pdf":
            data, filename, mimetype = build_pdf(spec, division), f"{spec['key']}_{spec['metadata']['Reference Number'].replace('/', '-')}.pdf", "application/pdf"
        else:
            extension = spec["format"]
            data = build_scan(spec, self.rng)
            filename = f"scan_{spec['key']}.{extension}"
            mimetype = "image/jpeg" if extension == "jpg" else "image/png"
        form = {
            "file": (io.BytesIO(data), filename, mimetype),
            "title": spec["title"],
            "metadata": json.dumps({**spec["metadata"], "Division": division}),
        }
        when = self.at(spec["when"])
        response, stamp = self.step(when, lambda: self.call("post", "/documents/upload", uploader, data=form, content_type="multipart/form-data"))
        document = response.get_json()
        stored = self.db.documents.find_one({"_id": parse_object_id(document["id"])}, {"gridfs_id": 1})
        self.db.documents.update_one({"_id": stored["_id"]}, {"$set": {"created_at": stamp}})
        self.db.fs.files.update_one({"_id": stored["gridfs_id"]}, {"$set": {"uploadDate": stamp}})
        self.documents[spec["key"]] = document["id"]
        return document

    def read(self, who, doc_key, when, kind="download"):
        """A download or preview; one denied attempt is part of the story too."""
        doc_id = self.documents[doc_key]
        self.step(self.at(when), lambda: self.client.get(f"/api/documents/{doc_id}/{kind}", headers={"Authorization": f"Bearer {self.tokens[who]}"}))

    # -- access requests --

    def request_access(self, spec):
        """Send one access request, then decide, revoke or expire it as the story says."""
        doc_id = self.documents[spec["doc"]]
        body = {"doc_id": doc_id, "reason": spec["reason"]}
        response, stamp = self.step(self.at(spec["when"]), lambda: self.call("post", "/access/request", spec["by"], json=body))
        request_id = response.get_json()["id"]
        requests = self.db.access_requests
        object_id = parse_object_id(request_id)
        requests.update_one({"_id": object_id}, {"$set": {"created_at": stamp}})

        decision = spec.get("decide")
        if decision:
            payload = {"request_id": request_id, "note": decision.get("note")}
            if decision["action"] == "approve":
                payload["expires_in_days"] = decision.get("days")
            _, decided = self.step(self.at(decision["when"]), lambda: self.call("post", f"/access/{decision['action']}", decision["by"], json=payload))
            changes = {"decided_at": decided}
            if decision["action"] == "approve" and decision.get("days"):
                # Expiry counts from the backdated decision, so a 7 day approval from two weeks ago has expired.
                changes["expires_at"] = decided + timedelta(days=decision["days"])
            requests.update_one({"_id": object_id}, {"$set": changes})

        # Reads that need the approval happen here, before any revoke takes it away.
        for read in spec.get("reads", []):
            self.read(read["by"], spec["doc"], read["when"], kind=read["kind"])

        revoke = spec.get("revoke")
        if revoke:
            body = {"request_id": request_id, "note": revoke["note"]}
            _, revoked = self.step(self.at(revoke["when"]), lambda: self.call("post", "/access/revoke", revoke["by"], json=body))
            requests.update_one({"_id": object_id}, {"$set": {"revoked_at": revoked}})

    # -- the story --

    def run(self):
        """Three weeks of work, in order: people join, files arrive, divisions ask each other for access."""
        self.admin_sign_in(self.at((24, "09:00")))
        for index, key in enumerate(USERS):
            self.register(key, self.at((23 - index, "10:30")))

        for spec in sorted(DOCUMENTS, key=lambda item: -item["when"][0]):
            who = spec["uploader"]
            if who != "admin":
                self.sign_in(who, self.at((spec["when"][0], "09:05")))
            else:
                self.admin_sign_in(self.at((spec["when"][0], "08:50")))
            self.upload(spec)

        for spec in REQUESTS:
            self.request_access(spec)

        self.read("ravi", "fleet", (18, "12:00"))
        self.read("ravi", "training", (8, "15:30"))
        self.read("arjun", "fuel", (7, "10:45"))  # rejected earlier, so this one is denied
        self.read("arjun", "convoy", (4, "16:10"))
        self.read("admin", "budget", (3, "10:00"))
        self.sign_in("ravi", self.at((2, "08:58")), password="wrong-password")
        self.sign_in("ravi", self.at((2, "08:59")))
        self.sign_in("meera", self.at((1, "11:05")))


def reset(db):
    """Remove everything the demo creates. Divisions, metadata fields and admins stay."""
    removed = {
        "documents": db.documents.delete_many({}).deleted_count,
        "files": db.fs.files.delete_many({}).deleted_count,
        "access_requests": db.access_requests.delete_many({}).deleted_count,
        "audit_logs": db.audit_logs.delete_many({}).deleted_count,
        "users": db.users.delete_many({"role": {"$ne": "admin"}}).deleted_count,
    }
    db.fs.chunks.delete_many({})
    return removed


def summarise(db):
    """Counts for the closing report."""
    documents = list(db.documents.find({}, {"division": 1, "content_type": 1, "ocr_status": 1}))
    statuses = Counter(request["status"] for request in db.access_requests.find({}, {"status": 1, "expires_at": 1}))
    expired = db.access_requests.count_documents({"status": "approved", "expires_at": {"$lte": datetime.now(timezone.utc)}})
    statuses["approved"] -= expired
    statuses["expired"] = expired
    return {
        "users": db.users.count_documents({"role": {"$ne": "admin"}}),
        "documents": len(documents),
        "by_division": dict(Counter(document["division"] for document in documents)),
        "scanned_images": sum(1 for document in documents if document["content_type"].startswith("image/")),
        "ocr": dict(Counter(document["ocr_status"] for document in documents)),
        "access_requests": dict(statuses),
        "audit_logs": db.audit_logs.count_documents({}),
    }


def run_demo_seed(app, reset_first=False):
    """Fill the database with the demo story. Returns (removed, summary)."""
    db = app.extensions["mongo_db"]
    removed = reset(db) if reset_first else {}
    if not reset_first and db.documents.estimated_document_count():
        raise DemoSeedRefused("This database already has documents. Run with --reset to replace them with the demo data.")
    DemoSeeder(app).run()
    return removed, summarise(db)


def main(argv=None):
    """Command-line entry point."""
    from app import create_app
    from app.seed import run_seed

    parser = argparse.ArgumentParser(description="Load the demo users, documents and access requests.")
    parser.add_argument("--reset", action="store_true", help="remove existing documents, requests, audit logs and non-admin users first")
    args = parser.parse_args(argv)

    # The seed makes many sign ins in a few seconds; the login rate limit protects real users, not this.
    app = create_app({"RATELIMIT_STORAGE_URI": "memory://", "RATELIMIT_ENABLED": False})
    run_seed(app.extensions["mongo_db"], app.config)
    try:
        removed, summary = run_demo_seed(app, reset_first=args.reset)
    except DemoSeedRefused as exc:
        print(exc, file=sys.stderr)
        return 1

    if removed:
        print("Removed:", ", ".join(f"{count} {name.replace('_', ' ')}" for name, count in removed.items()))
    print(f"Users: {summary['users']} demo users (password {DEMO_PASSWORD}) plus the admin")
    print(f"Documents: {summary['documents']} ({', '.join(f'{name} {count}' for name, count in sorted(summary['by_division'].items()))}), "
          f"{summary['scanned_images']} scanned images")
    print("Text extraction:", ", ".join(f"{status} {count}" for status, count in sorted(summary["ocr"].items())))
    print("Access requests:", ", ".join(f"{status} {count}" for status, count in sorted(summary["access_requests"].items())))
    print(f"Audit log entries: {summary['audit_logs']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
