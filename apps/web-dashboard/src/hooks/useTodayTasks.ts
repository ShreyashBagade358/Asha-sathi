import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ashaService } from '@/services/asha.service'
import { toggleViewTaskPayload, toViewTask, todayISO, type ViewTask } from '@/pages/asha/taskView'
import { getErrorMessage } from '@/components/common/ErrorState'
import { useUIStore } from '@/stores/ui.store'

/** Today's five-visit plan — the backend builds it on the first request. */
export function useTodayTasks() {
  const queryClient = useQueryClient()
  const addToast = useUIStore((s) => s.addToast)

  const query = useQuery({
    queryKey: ['asha', 'tasks', 'today'],
    queryFn: async () => {
      const tasks = await ashaService.listMyTasks({ date: todayISO() })
      return tasks.map(toViewTask)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: (task: ViewTask) => ashaService.updateTask(task.id, toggleViewTaskPayload(task)),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['asha', 'tasks'] }),
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const toggleTask = (task: ViewTask) => {
    if (toggleMutation.isPending) return
    toggleMutation.mutate(task)
  }

  return {
    ...query,
    tasks: query.data ?? [],
    toggleTask,
    isToggling: toggleMutation.isPending,
  }
}
