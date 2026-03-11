export const buildXtationExportStamp = (timestamp = Date.now()) => {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
};

export const downloadJsonPayload = async (filename: string, payload: unknown) => {
  const json = JSON.stringify(payload, null, 2);
  try {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    return true;
  } catch (error) {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(json);
      return true;
    }
    throw error;
  }
};
