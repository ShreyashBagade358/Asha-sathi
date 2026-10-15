import { getDashboardKpis, listTasks } from '../src/db/clinical';
import { getDatabase } from '../src/db/database';

/**
 * Guards for the two counting gaps the web/mobile comparison turned up:
 * cancelled rows were part of "All" (the web drops them in useTodayTasks), and
 * a beneficiary flagged high at intake never reached the high-risk tile (the
 * web adds high-risk pregnancies AND high-risk beneficiaries).
 */
describe('clinical task and KPI filters', () => {
  it("listTasks leaves cancelled rows out of 'all' and 'pending'", async () => {
    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO asha_tasks (id, asha_id, task_type, priority, status, task_date, created_at, updated_at, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      'cancelled-task-filter', 'asha-test', 'anc_visit', 'low', 'cancelled', '2099-01-01', now, now,
    );

    const all = await listTasks('all');
    const pending = await listTasks('pending');
    expect(all.some((row) => row.id === 'cancelled-task-filter')).toBe(false);
    expect(pending.some((row) => row.id === 'cancelled-task-filter')).toBe(false);
  });

  it('the high-risk KPI adds beneficiaries flagged high at intake', async () => {
    const db = await getDatabase();
    const before = await getDashboardKpis();

    await db.runAsync(`INSERT INTO beneficiaries (id, full_name, metadata_json) VALUES (?, ?, ?)`,
      'high-risk-beneficiary-filter', 'Intake High Risk', JSON.stringify({ risk: 'high' }));

    const after = await getDashboardKpis();
    expect(after.highRisk).toBe(before.highRisk + 1);
  });

  it('a cancelled task does not inflate the pending or today agenda KPIs', async () => {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const before = await getDashboardKpis();
    await db.runAsync(
      `INSERT INTO asha_tasks (id, asha_id, task_type, priority, status, task_date, created_at, updated_at, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      'cancelled-task-kpi', 'asha-test', 'anc_visit', 'high', 'cancelled', '2000-01-01', now, now,
    );

    const after = await getDashboardKpis();
    expect(after.pendingTasks).toBe(before.pendingTasks);
    expect(after.todayAgenda).toBe(before.todayAgenda);
  });
});
