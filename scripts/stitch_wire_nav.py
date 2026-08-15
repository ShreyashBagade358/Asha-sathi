"""
Wire stitch page nav links (`href="#"`) to real React Router routes.

For each generated page under apps/web-dashboard/src/pages/stitch/, this script:
  - Replaces `<a ... href="#">` anchors whose text matches known nav labels with
    React Router `<Link to="...">` elements.
  - Converts "Logout" anchors to the shared <LogoutButton /> component.
  - Adds the required imports (`Link`, `LogoutButton`) to each page.

Run:  python3 scripts/stitch_wire_nav.py
"""
import glob
import os
import re

PAGES_DIR = os.path.join(os.path.dirname(__file__), '..', 'apps', 'web-dashboard', 'src', 'pages', 'stitch')

# Label (normalized: lowercase, collapse whitespace) -> route.
# Order matters: longest/most specific labels first.
COMMON_ROUTES = [
    # Auth
    ('back to login', '/login'),
    ('login with password', '/login'),
    ('need help logging in?', '/account-recovery'),
    ('contact admin support', '/account-recovery'),

    # PHC admin desktop sidebar
    ('dashboard', '/phc/dashboard'),
    ('overview', '/phc/dashboard'),
    ('workers', '/phc/ashas'),
    ('beneficiaries', '/phc/beneficiaries'),
    ('maternal health', '/phc/maternal'),
    ('child health', '/phc/children'),
    ('referrals', '/phc/referrals'),
    ('high risk cases', '/phc/alerts/critical'),
    ('critical alerts', '/phc/alerts/critical'),
    ('reports', '/phc/reports/maternal'),
    ('analytics', '/phc/analytics'),
    ('inventory', '/phc/vaccination'),
    ('women directory', '/phc/maternal/pregnant'),

    # Breadcrumbs / back links
    ('back to workers list', '/phc/ashas'),
    ('back to beneficiaries', '/phc/beneficiaries'),
    ('back to households', '/phc/households'),
    ('back to referrals', '/phc/referrals'),
    ('back to patients', '/asha/patients'),
    ('patient dashboard', '/asha/patients'),
]

# Context-dependent bottom-nav labels.
ASHA_ROUTES = [
    ('home', '/asha/home'),
    ('households', '/asha/households'),
    ('patients', '/asha/patients'),
    ('tasks', '/asha/tasks'),
    ('profile', '/asha/patients/1/profile'),
]

PHC_ROUTES = [
    ('home', '/phc/dashboard'),
    ('households', '/phc/households'),
    ('patients', '/phc/beneficiaries'),
    ('tasks', '/phc/alerts'),
    ('profile', '/phc/dashboard'),
]

# Filename fragment -> back route for icon-only `arrow_back` anchors.
BACK_ROUTES = [
    ('ReferralDetailsPhcAdmin', '/phc/referrals'),
    ('CreateNewReferralPhcAdmin', '/phc/referrals'),
    ('ReferralDirectoryPhcAdmin', '/phc/referrals'),
    ('AshaWorkerProfile', '/phc/ashas'),
    ('AddNewAshaWorker', '/phc/ashas'),
    ('PregnancyDetails', '/phc/maternal/pregnant'),
    ('PregnantWomenList', '/phc/maternal/pregnant'),
    ('ChildProfile', '/phc/children'),
    ('ChildVaccinationSchedule', '/phc/children'),
    ('PatientDetailsAshaSathi', '/asha/patients'),
    ('PatientDashboardAshaSathi', '/asha/patients'),
    ('ImmunizationScheduleAshaSathi', '/asha/patients'),
    ('HouseholdDetails', '/phc/households'),
    ('HouseholdVisitSurveyAshaSathi', '/asha/households'),
    ('MyHealthProfileAshaSathi', '/asha/patients'),
]

# Icons (material symbol name) that we intentionally do NOT wire -> route.
IGNORED_ICONS = {'help', 'settings', 'sync', 'notifications', 'menu', 'print'}


def is_asha_page(filename: str) -> bool:
    return 'AshaSathi' in filename and 'PhcAdmin' not in filename


def normalize(text: str) -> str:
    return ' '.join(text.lower().split())


def strip_tags(html: str) -> str:
    return re.sub(r'<[^>]+>', '', html)


def resolve_route(label_text: str, asha: bool) -> str | None:
    norm = normalize(strip_tags(label_text))
    if not norm:
        return None
    norm = re.sub(r'\d+$', '', norm)
    routes = ASHA_ROUTES + COMMON_ROUTES if asha else PHC_ROUTES + COMMON_ROUTES
    for label, route in routes:
        if label == norm:
            return route
        if norm.endswith(label):
            return route
    return None


def resolve_back_route(filename: str) -> str | None:
    for frag, route in BACK_ROUTES:
        if frag in filename:
            return route
    return None


def process_file(path: str) -> bool:
    with open(path, encoding='utf-8') as fh:
        src = fh.read()

    original = src
    uses_link = False
    uses_logout = False
    asha = is_asha_page(os.path.basename(path))

    # Replace each <a ... href="#">...</a> block.
    pattern = re.compile(r'<a\b([^>]*?)\bhref="#"([^>]*)>(.*?)</a>', re.S)

    def repl(m: re.Match) -> str:
        nonlocal uses_link, uses_logout
        attrs = (m.group(1) + m.group(2)).strip()
        inner = m.group(3)
        text = strip_tags(inner)

        icon = re.search(r'material-symbols-outlined[^>]*">\s*([a-z0-9_]+)', inner)
        icon_name = icon.group(1) if icon else ''
        norm = normalize(text)

        # Logout special-case.
        if 'logout' in norm or 'log out' in norm:
            uses_logout = True
            return f'<LogoutButton className="{attrs.replace(chr(34), chr(39))}">{inner}</LogoutButton>'

        route = resolve_route(text, asha)

        # Icon-only arrow_back mobile back button.
        if route is None and icon_name == 'arrow_back' and not norm.replace('arrow_back', '').strip():
            route = resolve_back_route(os.path.basename(path))

        if route is None:
            return m.group(0)

        uses_link = True
        clean_attrs = attrs.replace('href="#"', '').strip()
        return f'<Link {clean_attrs} to="{route}">{inner}</Link>'

    src = pattern.sub(repl, src)

    if src == original:
        return False

    imports = []
    if uses_link and 'from \'react-router-dom\'' not in src:
        imports.append("import { Link } from 'react-router-dom'")
    if uses_logout and 'LogoutButton' not in src:
        imports.append("import { LogoutButton } from '@/components/stitch/LogoutButton'")

    if imports:
        first_import = re.search(r'^import .*$', src, re.M)
        if first_import:
            insert_at = first_import.end()
            src = src[:insert_at] + '\n' + '\n'.join(imports) + src[insert_at:]
        else:
            src = '\n'.join(imports) + '\n' + src

    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(src)
    return True


def main() -> None:
    changed = 0
    for path in sorted(glob.glob(os.path.join(PAGES_DIR, '*.tsx'))):
        if process_file(path):
            changed += 1
            print(f'wired  {os.path.basename(path)}')
    print(f'\nDone. {changed} files updated.')


if __name__ == '__main__':
    main()
