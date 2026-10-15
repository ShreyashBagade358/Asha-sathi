"""Import the full India geography hierarchy from the Census 2011 village directory.

Source: https://github.com/gggodhwani/indian_village_directory (village_list.csv)
Columns: state -> district -> block (census sub-district = taluk/tehsil) -> village,
each with its 2011 census code.

Loaded into `states`, `districts`, `blocks`, `phcs`, `sub_centers`, `villages` so
every location dropdown in the dashboard shows real Indian geography instead of
the single seeded demo chain.

`villages.sub_center_id` is NOT NULL, so each block gets a sub-centre, and a
block that has no PHC yet gets a placeholder PHC to hang that sub-centre from.
Both are clearly marked as import-generated in `address`.

Idempotent: parents are matched by (parent, name) and villages by code, so
re-running skips what is already there and keeps the seeded demo rows
(Uttar Pradesh / Lucknow / Sarojini Nagar / Khasra).

Run from the backend directory:

    python -m scripts.import_geo
"""

from __future__ import annotations

import csv
import logging
import shutil
import ssl
import subprocess
import sys
import time
import urllib.request
import uuid
from pathlib import Path

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_maker
from app.models.admin import PHC, Block, District, State, SubCenter, Village

DATA_URL = (
    "https://raw.githubusercontent.com/gggodhwani/indian_village_directory/master/village_list.csv"
)
DATA_DIR = Path(__file__).resolve().parents[1] / "data"
CSV_PATH = DATA_DIR / "india_villages.csv"

BATCH = 5000
PROGRESS_EVERY = 100_000
PLACEHOLDER_NOTE = "Auto-created by geo import to host village records"

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("import_geo")


def _clip(value: str | None, limit: int) -> str:
    return (value or "").strip()[:limit]


def ensure_csv() -> Path:
    if CSV_PATH.exists() and CSV_PATH.stat().st_size > 0:
        logger.info("Using cached %s (%.1f MB)", CSV_PATH, CSV_PATH.stat().st_size / 1e6)
        return CSV_PATH
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    logger.info("Downloading %s …", DATA_URL)
    started = time.time()
    tmp = CSV_PATH.with_suffix(".part")
    curl = shutil.which("curl")
    if curl:
        subprocess.run([curl, "-sSL", "--fail", "-o", str(tmp), DATA_URL], check=True)  # noqa: S603
    else:  # macOS system Python often has no SSL roots
        context = ssl._create_unverified_context()  # noqa: S323 - public dataset URL
        urllib.request.urlretrieve(DATA_URL, tmp, context=context)  # noqa: S310
    tmp.replace(CSV_PATH)
    logger.info("Downloaded in %.1fs (%.1f MB)", time.time() - started, CSV_PATH.stat().st_size / 1e6)
    return CSV_PATH


async def import_geo() -> None:
    csv_path = ensure_csv()
    started = time.time()

    async with async_session_maker() as session:
        # ---- existing rows, so a re-run never duplicates ------------------
        states_by_name = {
            name.lower(): sid
            for sid, name in (await session.execute(select(State.id, State.name))).all()
        }
        districts_by_key = {
            (state_id, name.lower()): did
            for state_id, name, did in (
                await session.execute(select(District.state_id, District.name, District.id))
            ).all()
        }
        blocks_by_key = {
            (district_id, name.lower()): bid
            for district_id, name, bid in (
                await session.execute(select(Block.district_id, Block.name, Block.id))
            ).all()
        }
        block_phc: dict[str, str] = {}
        for phc_id, block_id in (await session.execute(select(PHC.id, PHC.block_id))).all():
            block_phc.setdefault(block_id, phc_id)
        block_subcenter: dict[str, str] = {}
        for sc_id, block_id in (
            await session.execute(select(SubCenter.id, PHC.block_id).join(PHC, SubCenter.phc_id == PHC.id))
        ).all():
            block_subcenter.setdefault(block_id, sc_id)
        village_codes = set(
            (await session.execute(select(Village.code))).scalars().all()
        )

        counts = {
            "states": 0,
            "districts": 0,
            "blocks": 0,
            "phcs": 0,
            "sub_centers": 0,
            "villages": len(village_codes),
        }
        seen_rows = 0
        pending: list[dict] = []

        async def flush() -> None:
            if not pending:
                return
            await session.execute(Village.__table__.insert(), pending)
            await session.commit()
            pending.clear()

        with csv_path.open(newline="", encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                seen_rows += 1

                state_name = _clip(row.get("state_name"), 120)
                district_name = _clip(row.get("district_name"), 120)
                block_name = _clip(row.get("block_name"), 120)
                village_name = _clip(row.get("village_name"), 120)
                state_code = _clip(row.get("state_census_code_2011"), 10) or "NA"
                district_code = _clip(row.get("district_census_code_2011"), 10) or "NA"
                block_code = _clip(row.get("block_census_code_2011"), 10) or "NA"
                village_code = _clip(row.get("village_census_code_2011"), 10) or str(seen_rows)

                if not (state_name and district_name and block_name and village_name):
                    continue

                # state -------------------------------------------------
                state_id = states_by_name.get(state_name.lower())
                if state_id is None:
                    state = State(
                        code=state_code,
                        name=state_name,
                        name_local={},
                        is_active=True,
                    )
                    session.add(state)
                    await session.flush()
                    state_id = state.id
                    states_by_name[state_name.lower()] = state_id
                    counts["states"] += 1

                # district ----------------------------------------------
                key = (state_id, district_name.lower())
                district_id = districts_by_key.get(key)
                if district_id is None:
                    district = District(
                        state_id=state_id,
                        code=f"{state_code}-{district_code}"[:20],
                        name=district_name,
                        name_local={},
                        is_active=True,
                    )
                    session.add(district)
                    await session.flush()
                    district_id = district.id
                    districts_by_key[key] = district_id
                    counts["districts"] += 1

                # block (taluk/tehsil) ----------------------------------
                key = (district_id, block_name.lower())
                block_id = blocks_by_key.get(key)
                if block_id is None:
                    block = Block(
                        district_id=district_id,
                        code=f"{state_code}-{district_code}-{block_code}"[:20],
                        name=block_name,
                        name_local={},
                        is_active=True,
                    )
                    session.add(block)
                    await session.flush()
                    block_id = block.id
                    blocks_by_key[key] = block_id
                    counts["blocks"] += 1

                # PHC (placeholder when the block has none) --------------
                phc_id = block_phc.get(block_id)
                if phc_id is None:
                    phc = PHC(
                        block_id=block_id,
                        code=f"P-{state_code}-{district_code}-{block_code}"[:20],
                        name=f"{block_name} PHC",
                        name_local={},
                        address=PLACEHOLDER_NOTE,
                        is_active=True,
                    )
                    session.add(phc)
                    await session.flush()
                    phc_id = phc.id
                    block_phc[block_id] = phc_id
                    counts["phcs"] += 1

                # sub-centre (one per block) ----------------------------
                subcenter_id = block_subcenter.get(block_id)
                if subcenter_id is None:
                    subcenter = SubCenter(
                        phc_id=phc_id,
                        code=f"S-{state_code}-{district_code}-{block_code}"[:20],
                        name=f"{block_name} Sub-Centre",
                        name_local={},
                        is_active=True,
                    )
                    session.add(subcenter)
                    await session.flush()
                    subcenter_id = subcenter.id
                    block_subcenter[block_id] = subcenter_id
                    counts["sub_centers"] += 1

                # village -----------------------------------------------
                code = f"{state_code}-{village_code}"[:20]
                if code in village_codes:
                    continue
                village_codes.add(code)
                pending.append(
                    {
                        "id": str(uuid.uuid4()),
                        "sub_center_id": subcenter_id,
                        "code": code,
                        "name": village_name,
                        "name_local": {},
                        "is_active": True,
                    }
                )
                if len(pending) >= BATCH:
                    await flush()
                    if counts["villages"] // PROGRESS_EVERY != (
                        counts["villages"] - len(pending)
                    ) // PROGRESS_EVERY:
                        logger.info("… %s villages (%s file rows)", f"{counts['villages']:,}", f"{seen_rows:,}")

                counts["villages"] += 1

                if seen_rows % 25_000 == 0:
                    # cap transaction size on the parent rows
                    await session.commit()

        await flush()
        await polish_names(session)

    logger.info(
        "Imported %s rows in %.1fs — states +%s, districts +%s, blocks +%s, phcs +%s, "
        "sub-centres +%s, villages total %s (file rows %s)",
        f"{seen_rows:,}",
        time.time() - started,
        counts["states"],
        counts["districts"],
        counts["blocks"],
        counts["phcs"],
        counts["sub_centers"],
        f"{counts['villages']:,}",
        f"{seen_rows:,}",
    )
    logger.info(
        "Totals now: states %s, districts %s, blocks %s, phcs %s, sub-centres %s, villages %s",
        *(await table_counts()),
    )


async def polish_names(session: AsyncSession) -> None:
    """Census exports are ALL CAPS — title-case them so dropdowns read naturally.

    Gated on `name = upper(name)` so seeded/demo rows and already-mixed names
    stay untouched. Zero all-caps rows contain apostrophes (initcap would
    otherwise render "Mary'S"), verified against the seeded database.
    """
    # Census exports are ALL CAPS: initcap them, then lowercase the small words
    # initcap over-promotes ("Andaman And Nicobar Islands"). Rows where initcap
    # changes nothing (digits, "Y.S.R.") are skipped so re-runs stay cheap.
    expr = "initcap(lower(name))"
    for word in ("And", "Of", "The"):
        expr = f"replace({expr}, ' {word} ', ' {word.lower()} ')"
    total = 0
    for table in ("states", "districts", "blocks", "villages"):
        result = await session.execute(
            text(
                f"UPDATE {table} SET name = {expr} "  # noqa: S608
                "WHERE name = upper(name) AND name <> initcap(lower(name))"
            )
        )
        total += result.rowcount or 0
    # Second pass for rows initcap already capitalised ("Andaman And Nicobar").
    small = "name LIKE '% And %' OR name LIKE '% Of %' OR name LIKE '% The %'"
    for table in ("states", "districts", "blocks", "villages"):
        result = await session.execute(
            text(
                f"UPDATE {table} SET name = replace(replace(replace(name, ' And ', ' and '), "  # noqa: S608
                f"' Of ', ' of '), ' The ', ' the ') WHERE {small}"
            )
        )
        total += result.rowcount or 0
    # Placeholder PHC / sub-centre names embed the block name, so rebuild them
    # from the (now title-cased) block instead of initcap-ing the suffix too.
    result = await session.execute(
        text(
            "UPDATE phcs SET name = blocks.name || ' PHC' FROM blocks "
            "WHERE phcs.block_id = blocks.id AND phcs.address = :note "
            "AND phcs.name <> blocks.name || ' PHC'"
        ),
        {"note": PLACEHOLDER_NOTE},
    )
    total += result.rowcount or 0
    result = await session.execute(
        text(
            "UPDATE sub_centers SET name = blocks.name || ' Sub-Centre' "
            "FROM phcs, blocks WHERE sub_centers.phc_id = phcs.id AND phcs.block_id = blocks.id "
            "AND phcs.address = :note AND sub_centers.name LIKE '% Sub-Centre' "
            "AND sub_centers.name <> blocks.name || ' Sub-Centre'"
        ),
        {"note": PLACEHOLDER_NOTE},
    )
    total += result.rowcount or 0
    await session.commit()
    logger.info("Title-cased %s ALL CAPS geography names", total)


async def table_counts() -> tuple[int, ...]:
    async with async_session_maker() as session:
        counts = []
        for model in (State, District, Block, PHC, SubCenter, Village):
            counts.append(int(await session.scalar(select(func.count()).select_from(model))))
    return tuple(counts)


if __name__ == "__main__":
    import asyncio

    asyncio.run(import_geo())
    sys.exit(0)
