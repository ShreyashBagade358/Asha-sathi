import { insertLocalChild, insertLocalPregnancy, insertLocalReferral, listFollowUps, setFollowUpDate, setFollowUpDone } from '../src/db/clinical';
import { enqueue, getDatabase } from '../src/db/database';

/**
 * The module write contract the four new forms share: a local insert with the
 * table's NOT NULL columns filled, then an outbox row whose `data` is keyed by
 * the snake_case server columns (the sync push drops anything else).
 */
describe('module form writes', () => {
  it('insertLocalPregnancy fills the required local columns and defaults', async () => {
    const db = await getDatabase();
    const parent = await db.getFirstAsync<{ id: string }>('SELECT id FROM beneficiaries LIMIT 1');
    const id = 'preg-test-1';

    await insertLocalPregnancy({
      id,
      beneficiaryId: parent!.id,
      lmp: '2026-01-10',
      edd: '2026-10-17',
      riskLevel: 'high',
      riskFactors: { reason: 'anaemia' },
    });

    const row = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM pregnancies WHERE id = ?', id);
    expect(row).toBeTruthy();
    expect(row!.beneficiary_id).toBe(parent!.id);
    expect(row!.risk_level).toBe('high');
    expect(row!.anc_count).toBe(0);
    expect(row!.status).toBe('ongoing');
    expect(JSON.parse(String(row!.risk_factors))).toEqual({ reason: 'anaemia' });
  });

  it('queues the pregnancy as the server sees it', async () => {
    const db = await getDatabase();
    const parent = await db.getFirstAsync<{ id: string }>('SELECT id FROM beneficiaries LIMIT 1');
    const id = 'preg-test-2';

    await insertLocalPregnancy({ id, beneficiaryId: parent!.id, lmp: null, edd: '2026-11-01', riskLevel: 'low', riskFactors: null });
    await enqueue({
      clientRequestId: `create-pregnancy-${id}`,
      entity: 'pregnancies',
      operation: 'create',
      recordId: id,
      version: 1,
      data: {
        id,
        beneficiary_id: parent!.id,
        lmp: null,
        edd: '2026-11-01',
        risk_level: 'low',
        risk_factors: null,
        anc_count: 0,
        status: 'ongoing',
      },
    });

    const queued = await db.getFirstAsync<{ data: string; entity: string }>(
      'SELECT entity, data FROM sync_queue WHERE client_request_id = ?',
      `create-pregnancy-${id}`,
    );
    expect(queued?.entity).toBe('pregnancies');
    const data = JSON.parse(String(queued?.data));
    expect(data.beneficiary_id).toBe(parent!.id);
    expect(data.risk_level).toBe('low');
    // camelCase must never reach the push payload: _clean_columns drops it.
    expect(Object.keys(data).every((key) => !/[A-Z]/.test(key))).toBe(true);
  });

  it('insertLocalChild links child, mother and father', async () => {
    const db = await getDatabase();
    const ids = await db.getAllAsync<{ id: string }>('SELECT id FROM beneficiaries ORDER BY full_name LIMIT 3');
    expect(ids).toHaveLength(3);
    const child = ids[0]!.id;
    const mother = ids[1]!.id;
    const father = ids[2]!.id;
    const id = 'child-test-1';

    await insertLocalChild({
      id,
      beneficiaryId: child,
      motherId: mother,
      fatherId: father,
      birthWeightGrams: 2800,
      birthLengthCm: 48,
      gestationWeeks: 38,
    });

    const row = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM children WHERE id = ?', id);
    expect(row).toBeTruthy();
    expect(row!.beneficiary_id).toBe(child);
    expect(row!.mother_id).toBe(mother);
    expect(row!.father_id).toBe(father);
    expect(row!.birth_weight_grams).toBe(2800);
    expect(row!.gestation_weeks).toBe(38);
  });

  it('insertLocalReferral starts as initiated with no follow-up owed', async () => {
    const db = await getDatabase();
    const parent = await db.getFirstAsync<{ id: string }>('SELECT id FROM beneficiaries LIMIT 1');
    const id = 'ref-test-1';

    await insertLocalReferral({
      id,
      beneficiaryId: parent!.id,
      referralType: 'general',
      urgency: 'urgent',
      reason: 'Hb 7.2 g/dL',
      referredFromId: 'asha-test',
      referredFromFacilityId: 'SC-LKO-04',
      referredToFacilityId: 'CHC-LKO-01',
      initiatedAt: '2026-10-12T09:00:00.000Z',
    });

    const row = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM referrals WHERE id = ?', id);
    expect(row).toBeTruthy();
    expect(row!.status).toBe('initiated');
    expect(row!.followup_required).toBe(0);
    expect(row!.referred_to_facility_id).toBe('CHC-LKO-01');
  });

  it('rescheduling a referral follow-up moves the date and keys on it', async () => {
    const db = await getDatabase();
    const rows = await listFollowUps();
    const referral = rows.find((row) => row.kind === 'referral');
    expect(referral).toBeTruthy();

    await setFollowUpDate(referral!, '2099-03-01');

    const id = referral!.id.slice(referral!.id.indexOf(':') + 1);
    const row = await db.getFirstAsync<{ followup_date: string }>('SELECT followup_date FROM referrals WHERE id = ?', id);
    expect(row?.followup_date).toBe('2099-03-01');

    // The server replays a seen client_request_id, so the key must change with
    // the date or a second reschedule would silently keep the first date.
    const queued = await db.getAllAsync<{ client_request_id: string }>(
      'SELECT client_request_id FROM sync_queue WHERE entity = ? AND record_id = ?',
      'referrals',
      id,
    );
    expect(queued.map((item) => item.client_request_id)).toContain(`reschedule-referral-${id}-2099-03-01`);
  });

  it('completing a follow-up closes the referral it points at', async () => {
    const db = await getDatabase();
    const rows = await listFollowUps();
    const referral = rows.find((row) => row.kind === 'referral');
    expect(referral).toBeTruthy();

    await setFollowUpDone(referral!, true);

    const id = referral!.id.slice(referral!.id.indexOf(':') + 1);
    const row = await db.getFirstAsync<{ status: string }>('SELECT status FROM referrals WHERE id = ?', id);
    expect(row?.status).toBe('completed');
  });
});
