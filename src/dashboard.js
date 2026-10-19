// Account-local summaries only: no analytics SDK, tracking requests, or invented counts.
export function homeMetrics({ reminders = [], contacts = [], audit = [] } = {}, reference = new Date()) {
  const today = new Date(reference);
  today.setHours(0, 0, 0, 0);
  const visible = reminders.filter(reminder => !reminder.rejected && reminder.approved !== false && !(reminder.requiresApproval && !reminder.approved));
  const open = visible.filter(reminder => !reminder.completed);
  const completed = visible.filter(reminder => reminder.completed);
  const days = Array.from({ length: 7 }, (_, index) => {
    const start = new Date(today);
    start.setDate(start.getDate() - 6 + index);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return {
      date: start.toISOString(),
      label: start.toLocaleDateString(undefined, { weekday: 'short' }),
      fullLabel: start.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }),
      count: completed.filter(reminder => {
        const time = new Date(reminder.completedAt).getTime();
        return reminder.completedAt && time >= start.getTime() && time < end.getTime() && time <= reference.getTime();
      }).length
    };
  });
  return {
    total: visible.length,
    open: open.length,
    completed: completed.length,
    overdue: open.filter(reminder => new Date(reminder.due) < reference).length,
    contacts: contacts.filter(contact => contact.status === 'approved').length,
    completionRate: visible.length ? Math.round(completed.length * 100 / visible.length) : 0,
    completedThisWeek: days.reduce((sum, day) => sum + day.count, 0),
    days,
    recentActivity: audit.filter(entry => Number.isFinite(new Date(entry.at).getTime())).slice().sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 5)
  };
}
