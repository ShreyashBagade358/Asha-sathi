"""Import the functional PHC directory for Maharashtra.

Source: data/maharashtra_phcs.txt — District / Block / PHC rows (1828 PHCs).

The census geo import (scripts/import_geo.py) created one *placeholder* PHC per
block to host that block's villages. This script adds the real functional PHCs
under the matching block, then moves the placeholder's sub-centre (and every
village hanging off it) onto the block's first functional PHC and deletes the
placeholder — so the dashboard's District -> Block -> PHC cascade shows real
PHC names and the villages stay reachable.

District names are aliased to the census spellings (Bid -> Beed, Buldana ->
Buldhana, Gondiya -> Gondia, Raigarh -> Raigad); blocks are matched by a
normalised (case/space/punctuation-insensitive) name. Unmatched rows are
logged, never guessed.

Idempotent: a PHC that already exists under the block is skipped, so re-runs
are safe. Run from the backend directory:

    python -m scripts.import_phc_directory
"""

from __future__ import annotations

import logging
import re
import uuid
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_maker
from app.models.admin import PHC, Block, District, State, SubCenter

DATA_PATH = "data/maharashtra_phcs.txt"

# User list spelling -> census district name in the DB.
DISTRICT_ALIASES = {
    "bid": "beed",
    "buldana": "buldhana",
    "gondiya": "gondia",
    "raigarh": "raigad",
    "osmanabad": "osmanabad",
}

# (district, user block) -> census block, for name variants the two lists use.
BLOCK_ALIASES = {
    ("akola", "barshitakali"): "barshitakli",
    ("beed", "manjalegaon"): "manjlegaon",
    ("buldhana", "chikhali"): "chikhli",
    ("buldhana", "deulgaonraja"): "deolgaonraja",
    ("chandrapur", "jivati"): "jiwati",
    ("dhule", "shindkheda"): "sindkhede",
    ("gadchiroli", "wadsa"): "desaiganjvadasa",
    ("jalgaon", "bodwad"): "bodvad",
    ("jalgaon", "muktainagar"): "muktainagaredlabad",
    ("jalna", "ghansavanghi"): "ghansawangi",
    ("jalna", "jafrabad"): "jafferabad",
    ("kolhapur", "gaganbawada"): "bavda",
    ("nanded", "degloor"): "deglur",
    ("nanded", "mahur"): "mahoor",
    ("nanded", "naigaon"): "naigaonkhairgaon",
    ("nandurbar", "dhadgaon"): "akkalkuwa",
    ("nandurbar", "navapur"): "nawapur",
    ("nandurbar", "shahada"): "shahade",
    ("nandurbar", "taloda"): "talode",
    ("nashik", "chandwad"): "chandvad",
    ("nashik", "peint"): "peth",
    ("nashik", "trimbak"): "trimbakeshwar",
    ("nashik", "yeola"): "yevla",
    ("osmanabad", "bhoom"): "bhum",
    ("osmanabad", "omerga"): "umarga",
    ("parbhani", "manwat"): "manwath",
    ("pune", "purandar"): "purandhar",
    ("sangli", "atapadi"): "atpadi",
    ("yavatmal", "babhulgaon"): "babulgaon",
}

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("import_phc_directory")


def _norm(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (name or "").lower())


def _code(prefix: str, name: str, n: int) -> str:
    slug = re.sub(r"[^A-Z0-9]", "", name.upper())[:8] or "X"
    return f"{prefix}-{slug}-{n:04d}"[:20]


def load_rows() -> list[tuple[str, str]]:
    """Parse the directory file into (district, "block + phc") pairs."""
    rows: list[tuple[str, str]] = []
    with open(DATA_PATH, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            parts = line.split(" ", 2)
            if len(parts) < 3 or not parts[0].isdigit():
                continue
            rows.append((parts[1], parts[2]))
    return rows


async def import_phcs(session: AsyncSession) -> dict:
    state = (
        await session.execute(select(State).where(State.name.ilike("maharashtra")))
    ).scalars().first()
    if not state:
        raise SystemExit("Maharashtra state not found — run scripts/import_geo.py first")

    districts = (
        await session.execute(select(District).where(District.state_id == state.id))
    ).scalars().all()
    dist_by_norm: dict[str, District] = {}
    for d in districts:
        dist_by_norm[_norm(d.name)] = d

    # district.id -> {norm block name -> Block}
    blocks_by_dist: dict[str, dict[str, Block]] = defaultdict(dict)
    all_blocks = (
        await session.execute(
            select(Block).where(Block.district_id.in_([d.id for d in districts]))
        )
    ).scalars().all()
    for b in all_blocks:
        blocks_by_dist[b.district_id][_norm(b.name)] = b

    raw_rows = load_rows()

    # Preload every PHC already in Maharashtra so the loop is pure dict work.
    existing_phcs = (
        await session.execute(
            select(PHC).where(PHC.block_id.in_([b.id for b in all_blocks]))
        )
    ).scalars().all()
    by_block_name: dict[tuple[str, str], PHC] = {
        (p.block_id, p.name): p for p in existing_phcs
    }

    created = skipped = 0
    unmatched: list[str] = []
    first_phc_of_block: dict[str, PHC] = {}

    for dist_name, rest in raw_rows:
        dist_norm = DISTRICT_ALIASES.get(dist_name.lower(), _norm(dist_name))
        district = dist_by_norm.get(dist_norm)
        if not district:
            unmatched.append(f"district '{dist_name}'")
            continue
        # Longest-prefix match against the known block names; the rest is the PHC.
        # Spelling variants from the directory are aliased to the census name.
        tokens = rest.split()
        block = None
        phc_name = None
        for take in range(len(tokens) - 1, 0, -1):
            candidate = _norm(" ".join(tokens[:take]))
            blocks_here = blocks_by_dist[district.id]
            if candidate not in blocks_here:
                alias = BLOCK_ALIASES.get((dist_norm, candidate))
                if alias:
                    candidate = alias
            if candidate in blocks_here:
                block = blocks_here[candidate]
                phc_name = " ".join(tokens[take:])
                break
        if not block or not phc_name:
            unmatched.append(f"block in {district.name}: '{rest}'")
            continue

        existing = by_block_name.get((block.id, phc_name))
        if existing:
            skipped += 1
            if block.id not in first_phc_of_block:
                first_phc_of_block[block.id] = existing
            continue

        phc = PHC(
            id=str(uuid.uuid4()),
            block_id=block.id,
            code=_code("MH-PHC", phc_name, created + 1),
            name=phc_name,
            address=f"Functional PHC - {district.name} / {block.name}",
            is_active=True,
        )
        session.add(phc)
        by_block_name[(block.id, phc_name)] = phc
        created += 1
        if block.id not in first_phc_of_block:
            first_phc_of_block[block.id] = phc
        if created % 200 == 0:
            await session.flush()
            logger.info("... %s PHCs staged", created)

    await session.flush()

    # Re-home each block's placeholder PHC onto its first functional PHC.
    target_ids = [p.id for p in first_phc_of_block.values()]
    placeholders = (
        await session.execute(
            select(PHC).where(
                PHC.block_id.in_(list(first_phc_of_block.keys())),
                PHC.address.like("Auto-created by geo import%"),
            )
        )
    ).scalars().all()
    subs_by_phc: dict[str, list[SubCenter]] = defaultdict(list)
    all_subs = (
        await session.execute(
            select(SubCenter).where(
                SubCenter.phc_id.in_(target_ids + [p.id for p in placeholders])
            )
        )
    ).scalars().all()
    for sc in all_subs:
        subs_by_phc[sc.phc_id].append(sc)

    moved = placeholders_deleted = 0
    for ph in placeholders:
        target = first_phc_of_block.get(ph.block_id)
        if not target or ph.id == target.id:
            continue
        for sc in subs_by_phc.get(ph.id, []):
            sc.phc_id = target.id
            moved += 1
        await session.delete(ph)
        placeholders_deleted += 1

    # Give brand-new PHCs (no villages yet) one sub-centre so the
    # registration cascade has somewhere for villages to land later.
    with_sub = {sc.phc_id for sc in all_subs}
    for phc in first_phc_of_block.values():
        if phc.id not in with_sub:
            session.add(
                SubCenter(
                    id=str(uuid.uuid4()),
                    phc_id=phc.id,
                    code=_code("MH-SC", phc.name, 1),
                    name=f"{phc.name} Sub-centre",
                    is_active=True,
                )
            )

    await session.commit()
    return {
        "created": created,
        "skipped": skipped,
        "subcenters_moved": moved,
        "placeholders_deleted": placeholders_deleted,
        "unmatched": unmatched,
    }


def main() -> None:
    import asyncio

    async def run() -> None:
        async with async_session_maker() as session:
            stats = await import_phcs(session)
        logger.info(
            "PHCs created=%s skipped(existing)=%s sub-centres re-homed=%s placeholders deleted=%s",
            stats["created"],
            stats["skipped"],
            stats["subcenters_moved"],
            stats["placeholders_deleted"],
        )
        if stats["unmatched"]:
            uniq = sorted(set(stats["unmatched"]))
            logger.warning("%s unmatched rows (first 20):", len(stats["unmatched"]))
            for u in uniq[:20]:
                logger.warning("  %s", u)

    asyncio.run(run())


if __name__ == "__main__":
    main()
