// Calculate form completion progress based on filled fields
export function calculateFormProgress(aData: any, bData: any, cData: any, dData: any): number {
  const fields = {
    // Part A - Identity & Assets (~45 fields)
    a: [
      aData?.engType,
      aData?.state,
      aData?.c1?.first,
      aData?.c1?.last,
      aData?.c1?.email,
      aData?.c1?.mobile,
      aData?.c2?.first,
      aData?.c2?.last,
      aData?.hasChildren,
      aData?.disclosureLevel,
      aData?.c1HasProperty,
      aData?.c1HasBank,
      aData?.c1HasShares,
      aData?.c2HasProperty,
      aData?.c2HasBank,
      aData?.c2HasShares,
    ],
    // Part B - Business & Insurance (~30 fields)
    b: [
      bData?.c1HasBiz,
      bData?.c1HasTrusts,
      bData?.c1HasSmsf,
      bData?.c1HasIns,
      bData?.c2HasBiz,
      bData?.c2HasTrusts,
      bData?.accountant,
      bData?.uploadedFiles?.length,
    ],
    // Part C - Wills & Executors (~25 fields)
    c: [
      cData?.mirrorWill,
      cData?.c1ExecCount,
      cData?.c2ExecCount,
      cData?.guardianCount,
      cData?.c1HasExistingWill,
      cData?.c2HasExistingWill,
      cData?.beneProfiles,
    ],
    // Part D - EPA & Funeral (~20 fields)
    d: [
      dData?.c1EpaHealth,
      dData?.c1EpaFin,
      dData?.c1BurialPref,
      dData?.c2EpaHealth,
      dData?.c2EpaFin,
      dData?.c2BurialPref,
      dData?.c1SignDate,
      dData?.c2SignDate,
    ],
  };

  // Count filled fields (non-empty, non-zero, non-false)
  const isFilled = (value: any): boolean => {
    if (value === null || value === undefined || value === '') return false;
    if (value === false) return false;
    if (typeof value === 'number' && value === 0) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (typeof value === 'object' && Object.keys(value).length === 0) return false;
    return true;
  };

  const totalFields = Object.values(fields).flat().length;
  const filledFields = Object.values(fields)
    .flat()
    .filter(isFilled).length;

  // Ensure we return an integer between 0-100
  const progress = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
  return Math.max(0, Math.min(100, progress));
}

// Get status badge based on progress
export function getFormStatus(progressPct: number): 'open' | 'pending' | 'completed' {
  if (progressPct === 0) return 'open';
  if (progressPct < 100) return 'pending';
  return 'completed';
}

// Get status display info
export function getStatusDisplay(status: 'open' | 'pending' | 'completed') {
  const statusMap = {
    open: { label: '🟡 Open', color: '#FFA500', bg: '#FFF3E0' },
    pending: { label: '🟡 Pending', color: '#FFA500', bg: '#FFF3E0' },
    completed: { label: '🟢 Completed', color: '#4CAF50', bg: '#E8F5E9' },
  };
  return statusMap[status];
}
