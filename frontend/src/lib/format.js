const dateTime = new Intl.DateTimeFormat(undefined, {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

const dateOnly = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export const formatDateTime = (value) => (value ? dateTime.format(new Date(value)) : '');
export const formatDate = (value) => (value ? dateOnly.format(new Date(value)) : '');

/** Movement quantities read better signed: +12 arrived, -12 left. */
export const signed = (n) => (n > 0 ? `+${n}` : String(n));
