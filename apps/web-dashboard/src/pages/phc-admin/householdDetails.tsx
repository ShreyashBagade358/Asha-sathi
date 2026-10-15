import { useState, type FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { householdService, type CreateHouseholdPayload } from '@/services/household.service';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { useUIStore } from '@/stores/ui.store';
import { relationshipLabel } from '@/lib/relationship';

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const inputCls =
  'h-12 w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';

export default function HouseholdDetailsPhcAdmin() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useUIStore();

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<Partial<CreateHouseholdPayload>>({});
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);

  const {
    data: household,
    isLoading: hhLoading,
    isError: hhError,
    error: hhErrorObj,
  } = useQuery({
    queryKey: ['household-detail', id],
    queryFn: () => householdService.getHousehold(id!),
    enabled: !!id,
  });

  const {
    data: membersData,
    isLoading: membersLoading,
    isError: membersError,
    error: membersErrorObj,
  } = useQuery({
    queryKey: ['household-members', id],
    queryFn: () => householdService.listHouseholdMembers(id!, { pageSize: 50 }),
    enabled: !!id,
  });

  const isLoading = hhLoading || membersLoading;
  const isError = hhError || membersError;
  const error = hhErrorObj || membersErrorObj;

  const editMutation = useMutation({
    mutationFn: (payload: Partial<CreateHouseholdPayload>) =>
      householdService.updateHousehold(id!, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['household-detail', id] });
      void queryClient.invalidateQueries({ queryKey: ['households'] });
      setShowEdit(false);
      addToast('success', 'Household updated');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error && err.message ? err.message : 'Failed to update household';
      addToast('error', msg);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (beneficiaryId: string) => householdService.removeMember(id!, beneficiaryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['household-members', id] });
      void queryClient.invalidateQueries({ queryKey: ['household-detail', id] });
      setRemoveTarget(null);
      addToast('success', 'Member removed from household');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error && err.message ? err.message : 'Failed to remove member';
      addToast('error', msg);
      setRemoveTarget(null);
    },
  });

  function openEdit() {
    if (!household) return;
    setEditForm({
      address: household.address ?? '',
      headName: household.headName ?? '',
      familySize: household.familySize,
      contactPhone: household.contactPhone ?? '',
      ward: household.ward ?? '',
      notes: household.notes ?? '',
    });
    setShowEdit(true);
  }

  function saveEdit(e: FormEvent) {
    e.preventDefault();
    editMutation.mutate(editForm);
  }

  const members = membersData?.items ?? [];
  const memberCount = membersData?.total ?? members.length;

  if (isLoading) {
    return (
        <div className="flex items-center justify-center py-24">
          <LoadingState label="Loading household…" />
        </div>
    );
  }

  if (isError || !household) {
    return (
        <div className="flex items-center justify-center py-24">
          <ErrorState message={getErrorMessage(error)} />
        </div>
    );
  }

  return (
    <>
      <div className="mx-auto w-full max-w-[1440px] flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/phc/households"
              className="flex items-center gap-2 text-primary hover:bg-surface-container-low px-3 py-1.5 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              <span className="font-label-md text-label-md hidden sm:inline">
                Back to Households
              </span>
            </Link>
            <h1 className="font-headline-lg text-headline-lg text-on-surface flex items-center gap-2">
              Household Details
              <span className="bg-surface-container text-on-surface-variant font-label-md text-label-md px-3 py-[2px] rounded-full border border-outline-variant">
                HHID: {household.householdId}
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={openEdit}
              className="flex items-center gap-2 border border-outline hover:bg-surface-container-low text-primary font-label-md text-label-md px-4 h-10 rounded-xl transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">edit</span>
              <span className="hidden md:inline">Edit Details</span>
            </button>
            <button
              onClick={() => navigate(`/phc/households/${id}/survey`)}
              className="flex items-center gap-2 bg-primary text-on-primary hover:opacity-90 font-label-md text-label-md px-4 h-10 rounded-xl transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[20px]">add_box</span>
              <span>Log Visit</span>
            </button>
          </div>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-2 shadow-sm">
            <div className="flex items-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px] text-tertiary">home</span>
              <h2 className="font-label-md text-label-md uppercase tracking-wider">Location</h2>
            </div>
            <div className="font-body-lg text-body-lg text-on-surface mt-auto">
              {household.village || '—'}
            </div>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-2 shadow-sm">
            <div className="flex items-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px] text-primary">group</span>
              <h2 className="font-label-md text-label-md uppercase tracking-wider">
                Total Members
              </h2>
            </div>
            <div className="flex items-baseline gap-2 mt-auto">
              <span className="font-display-lg text-display-lg text-on-surface">
                {memberCount}
              </span>
              <span className="font-caption text-caption text-on-surface-variant">
                Registered
              </span>
            </div>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-2 shadow-sm">
            <div className="flex items-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px] text-secondary">
                pregnant_woman
              </span>
              <h2 className="font-label-md text-label-md uppercase tracking-wider">
                Pregnant Women
              </h2>
            </div>
            <div className="font-body-lg text-body-lg text-on-surface mt-auto">
              {household.pregnantWomen}
            </div>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-2 shadow-sm">
            <div className="flex items-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px] text-primary">
                child_care
              </span>
              <h2 className="font-label-md text-label-md uppercase tracking-wider">
                Children {'<'} 5
              </h2>
            </div>
            <div className="font-body-lg text-body-lg text-on-surface mt-auto">
              {household.childrenUnder5}
            </div>
          </div>
        </section>

        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden min-h-[200px]">
          {membersLoading ? (
            <LoadingState label="Loading members…" />
          ) : membersError ? (
            <ErrorState message={getErrorMessage(membersErrorObj)} />
          ) : members.length === 0 ? (
            <EmptyState
              title="No members found"
              description="This household has no registered members yet."
              icon="group_off"
            />
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-low border-b border-outline-variant">
                  <tr>
                    <th className="py-3 px-4 font-label-md text-label-md text-on-surface-variant font-medium">
                      Name
                    </th>
                    <th className="py-3 px-4 font-label-md text-label-md text-on-surface-variant font-medium">
                      Age
                    </th>
                    <th className="py-3 px-4 font-label-md text-label-md text-on-surface-variant font-medium">
                      Gender
                    </th>
                    <th className="py-3 px-4 font-label-md text-label-md text-on-surface-variant font-medium">
                      Relationship
                    </th>
                    <th className="py-3 px-4 font-label-md text-label-md text-on-surface-variant font-medium">
                      Marital Status
                    </th>
                    <th className="py-3 px-4 font-label-md text-label-md text-on-surface-variant font-medium">
                      Pregnant
                    </th>
                    <th className="py-3 px-4 font-label-md text-label-md text-on-surface-variant font-medium text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {members.map((m) => (
                    <tr
                      key={m.id}
                      className="hover:bg-surface-container-lowest transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container text-on-primary-container text-caption font-semibold">
                            {initials(m.fullName)}
                          </span>
                          <div>
                            <div className="font-body-md text-body-md text-on-surface font-medium">
                              {m.fullName}
                            </div>
                            {m.beneficiaryId && (
                              <div className="font-caption text-caption text-on-surface-variant">
                                ID: {m.beneficiaryId}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-body-md text-body-md">
                        {m.ageYears != null
                          ? `${m.ageYears}y`
                          : m.ageMonths != null
                            ? `${m.ageMonths}m`
                            : '—'}
                      </td>
                      <td className="py-3 px-4 font-body-md text-body-md capitalize">
                        {m.gender || '—'}
                      </td>
                      <td className="py-3 px-4 font-body-md text-body-md">
                        {relationshipLabel(m.relationshipToHead)}
                      </td>
                      <td className="py-3 px-4 font-body-md text-body-md capitalize">
                        {m.maritalStatus || '—'}
                      </td>
                      <td className="py-3 px-4">
                        {m.isPregnant ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-[2px] rounded-full bg-tertiary-container text-on-tertiary-container font-caption text-caption font-semibold">
                            <span className="material-symbols-outlined text-[14px]">
                              pregnant_woman
                            </span>
                            Yes
                          </span>
                        ) : (
                          <span className="text-caption text-on-surface-variant">No</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {m.beneficiaryId ? (
                          <button
                            type="button"
                            title="Remove from household"
                            onClick={() =>
                              setRemoveTarget({ id: m.beneficiaryId, name: m.fullName })
                            }
                            className="text-error hover:bg-error-container/40 p-1 rounded transition-colors"
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              person_remove
                            </span>
                          </button>
                        ) : null}
                        {m.beneficiaryId ? (
                          <Link
                            to={`/phc/beneficiaries/${m.beneficiaryId}`}
                            className="text-primary hover:text-primary-container p-1 rounded hover:bg-surface-container-low transition-colors"
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              chevron_right
                            </span>
                          </Link>
                        ) : (
                          <span className="text-on-surface-variant/30 p-1 inline-flex">
                            <span className="material-symbols-outlined text-[20px]">
                              chevron_right
                            </span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {showEdit && (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-household-title"
        >
          <form
            className="w-full max-w-lg rounded-xl border border-outline-variant bg-surface p-5 shadow-card"
            onSubmit={saveEdit}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2
                id="edit-household-title"
                className="text-headline-md text-on-surface font-semibold"
              >
                Edit Details
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowEdit(false)}
                className="rounded-full p-1 text-on-surface-variant hover:bg-surface-container-low transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-label-md text-on-surface-variant" htmlFor="hh_address">
                  Address
                </label>
                <input
                  id="hh_address"
                  className={inputCls}
                  type="text"
                  value={editForm.address ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-label-md text-on-surface-variant" htmlFor="hh_head">
                  Head of Family
                </label>
                <input
                  id="hh_head"
                  className={inputCls}
                  type="text"
                  value={editForm.headName ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, headName: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-label-md text-on-surface-variant" htmlFor="hh_size">
                  Family Size
                </label>
                <input
                  id="hh_size"
                  className={inputCls}
                  inputMode="numeric"
                  max={99}
                  min={0}
                  type="number"
                  value={editForm.familySize ?? ''}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      familySize: e.target.value === '' ? undefined : Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-label-md text-on-surface-variant" htmlFor="hh_phone">
                  Contact Phone
                </label>
                <input
                  id="hh_phone"
                  className={inputCls}
                  type="tel"
                  value={editForm.contactPhone ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, contactPhone: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-label-md text-on-surface-variant" htmlFor="hh_ward">
                  Ward
                </label>
                <input
                  id="hh_ward"
                  className={inputCls}
                  type="text"
                  value={editForm.ward ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, ward: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowEdit(false)}
                className="flex items-center justify-center rounded-full px-5 py-2 font-label-md text-label-md font-semibold text-gray-600 transition-colors hover:bg-surface-container-highest"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editMutation.isPending}
                className="flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-2 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:opacity-90 disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                {editMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {removeTarget && (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-member-title"
        >
          <div className="w-full max-w-sm rounded-xl border border-outline-variant bg-surface p-5 shadow-card">
            <h2 id="remove-member-title" className="text-headline-md text-on-surface font-semibold">
              Remove member
            </h2>
            <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
              Remove <span className="font-semibold text-on-surface">{removeTarget.name}</span> from
              this household? The member record itself is kept.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRemoveTarget(null)}
                className="flex items-center justify-center rounded-full px-5 py-2 font-label-md text-label-md font-semibold text-gray-600 transition-colors hover:bg-surface-container-highest"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removeMemberMutation.isPending}
                onClick={() => removeMemberMutation.mutate(removeTarget.id)}
                className="flex items-center justify-center rounded-full bg-error px-6 py-2 font-label-md text-label-md font-semibold text-on-error shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {removeMemberMutation.isPending ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
