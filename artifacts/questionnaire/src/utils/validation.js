// ─── Primitive helpers ────────────────────────────────────────────────────────

function empty(v) {
  return v === null || v === undefined || !String(v).trim();
}
function emailOk(v) {
  return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(String(v).trim());
}
function mobileOk(v) {
  const d = String(v || '').replace(/[\s\-]/g, '');
  return /^04\d{8}$/.test(d) || /^\+614\d{8}$/.test(d);
}
function ausPhoneOk(v) {
  const d = String(v || '').replace(/[\s\-]/g, '');
  return /^0(4\d{8}|[23780]\d{8})$/.test(d) || /^\+61(4\d{8}|[23780]\d{8})$/.test(d);
}
function dob18ok(v) {
  const d = new Date(v);
  if (isNaN(d)) return false;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return d <= cutoff;
}
function notFuture(v) {
  const d = new Date(v);
  return !isNaN(d) && d <= new Date();
}
function dollarOk(v) {
  const s = String(v || '').replace(/[,\s]/g, '');
  if (!s) return false;
  return /^\d+(\.\d{1,2})?$/.test(s) && parseFloat(s) >= 0;
}
function pctInRange(v) {
  const n = parseFloat(v);
  return !isNaN(n) && n >= 0 && n <= 100;
}

function pe(errors, field, message) {
  errors.push({ field, message });
}

// Run format check ONLY when value is non-empty
function ifSet(val, fn) {
  if (!empty(val)) fn();
}

// ─── Format-only sub-validators ───────────────────────────────────────────────

function validatePersonalFormat(errors, px, aData) {
  const c = aData[px] || {};
  const f = k => `${px}.${k}`;

  ifSet(c.email,    () => { if (!emailOk(c.email))    pe(errors, f('email'),    'Please enter a valid email address (e.g. name@domain.com)'); });
  ifSet(c.mobile,   () => { if (!mobileOk(c.mobile))  pe(errors, f('mobile'),   'Mobile must start with 04 and be 10 digits (e.g. 0412 345 678)'); });
  ifSet(c.homePhone,() => { if (!ausPhoneOk(c.homePhone)) pe(errors, f('homePhone'), 'Please enter a valid Australian phone number (10 digits starting 02/03/07/08 or 04)'); });
  ifSet(c.dob,      () => { if (!dob18ok(c.dob))      pe(errors, f('dob'),      'Client must be at least 18 years old'); });
  ifSet(c.relDate,  () => { if (!notFuture(c.relDate)) pe(errors, f('relDate'), 'Date cannot be in the future'); });
}

function validatePersonListFormat(errors, list, count, nounKey) {
  list.slice(0, count).forEach((p, idx) => {
    const f = k => `${nounKey}_${idx}_${k}`;
    ifSet(p.email,  () => { if (!emailOk(p.email))   pe(errors, f('email'),  'Please enter a valid email address (e.g. name@domain.com)'); });
    ifSet(p.mobile, () => { if (!mobileOk(p.mobile)) pe(errors, f('mobile'), 'Mobile must start with 04 and be 10 digits (e.g. 0412 345 678)'); });
    ifSet(p.addr,   () => { if (String(p.addr).trim().length < 10) pe(errors, f('addr'), 'Please enter a complete address (at least 10 characters)'); });
    ifSet(p.dob,    () => { if (!notFuture(p.dob))   pe(errors, f('dob'),   'Date of birth cannot be in the future'); });
  });
}

function validateFinancialFormat(errors, px, aData) {
  const propCount = parseInt(aData[`${px}PropCount`] || 0);
  (aData[`${px}Props`] || []).slice(0, propCount).forEach((p, idx) => {
    ifSet(p.estValue, () => { if (!dollarOk(p.estValue)) pe(errors, `property_${idx}_estValue`, 'Please enter a valid dollar amount (e.g. 850,000)'); });
    ifSet(p.addr,     () => { if (String(p.addr).trim().length < 10) pe(errors, `property_${idx}_addr`, 'Please enter a complete address (at least 10 characters)'); });
    ifSet(p.year,     () => {
      const y = parseInt(p.year), cy = new Date().getFullYear();
      if (isNaN(y) || y < 1800 || y > cy) pe(errors, `property_${idx}_year`, `Please enter a valid year (1800–${cy})`);
    });
  });

  const bankCount = parseInt(aData[`${px}BankCount`] || 0);
  (aData[`${px}Banks`] || []).slice(0, bankCount).forEach((b, idx) => {
    ifSet(b.balance, () => { if (!dollarOk(b.balance)) pe(errors, `bank_account_${idx}_balance`, 'Please enter a valid dollar amount'); });
  });

  const shareCount = parseInt(aData[`${px}ShareCount`] || 0);
  (aData[`${px}Shares`] || []).slice(0, shareCount).forEach((s, idx) => {
    ifSet(s.value, () => { if (!dollarOk(s.value)) pe(errors, `share_portfolio_${idx}_value`, 'Please enter a valid dollar amount'); });
  });

  const superCount = parseInt(aData[`${px}SuperCount`] || 0);
  (aData[`${px}Supers`] || []).slice(0, superCount).forEach((s, idx) => {
    ifSet(s.balance, () => { if (!dollarOk(s.balance)) pe(errors, `super_fund_${idx}_balance`, 'Please enter a valid dollar amount'); });
    ifSet(s.abn,     () => { if (!/^\d{11}$/.test(String(s.abn).replace(/\s/g, ''))) pe(errors, `super_fund_${idx}_abn`, 'ABN must be exactly 11 digits'); });
  });

  const mortCount = parseInt(aData[`${px}MortCount`] || 0);
  (aData[`${px}Morts`] || []).slice(0, mortCount).forEach((m, idx) => {
    ifSet(m.balance, () => { if (!dollarOk(m.balance)) pe(errors, `mortgage_${idx}_balance`, 'Please enter a valid dollar amount'); });
  });

  const loanCount = parseInt(aData[`${px}LoanCount`] || 0);
  (aData[`${px}Loans`] || []).slice(0, loanCount).forEach((l, idx) => {
    ifSet(l.balance, () => { if (!dollarOk(l.balance)) pe(errors, `loan_${idx}_balance`, 'Please enter a valid dollar amount'); });
  });
}

function validateSmsfFormat(errors, px, bData) {
  const count = parseInt(bData[`${px}SmsfCount`] || 0);
  (bData[`${px}SmsfList`] || []).slice(0, count).forEach((s, idx) => {
    ifSet(s.totalValue, () => { if (!dollarOk(s.totalValue)) pe(errors, `smsf_${idx}_totalValue`, 'Please enter a valid dollar amount'); });
    ifSet(s.abn,        () => { if (!/^\d{11}$/.test(String(s.abn).replace(/\s/g, ''))) pe(errors, `smsf_${idx}_abn`, 'ABN must be exactly 11 digits'); });
  });
}

function validateDistributionFormat(errors, D, prefix) {
  const gc = parseInt(D.giftCount || 0);
  (D.gifts || []).slice(0, gc).forEach((g, idx) => {
    ifSet(g.bAddr, () => { if (String(g.bAddr).trim().length < 10) pe(errors, `${prefix}_gift_${idx}_bAddr`, 'Please enter a complete address (at least 10 characters)'); });
  });

  const rc = parseInt(D.resBeneCount || 0);
  let total = 0;
  let allPctEntered = rc > 0;
  (D.resBenes || []).slice(0, rc).forEach((r, idx) => {
    if (empty(r.pct)) {
      allPctEntered = false;
    } else if (!pctInRange(r.pct)) {
      pe(errors, `${prefix}_resbene_${idx}_pct`, 'Percentage must be between 0 and 100');
      allPctEntered = false;
    } else {
      total += parseFloat(r.pct);
    }
    ifSet(r.addr, () => { if (String(r.addr).trim().length < 10) pe(errors, `${prefix}_resbene_${idx}_addr`, 'Please enter a complete address (at least 10 characters)'); });
  });
  if (allPctEntered && rc > 0 && Math.abs(total - 100) > 0.01) {
    pe(errors, `${prefix}.resBeneCount`, `Beneficiary percentages must total 100% (currently ${total.toFixed(1)}%)`);
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function validatePage(pageKey, aData, bData, cData, dData) {
  const errors = [];
  const isCouple = (aData.engType || '').startsWith('Couple');

  switch (pageKey) {

    case 'welcome':
      // THE ONLY required field in the entire form
      if (!aData.engType) {
        pe(errors, 'engType', 'Please select an engagement type to continue');
      }
      // Format-only (only fires when non-empty)
      ifSet(aData.refEmail, () => { if (!emailOk(aData.refEmail))    pe(errors, 'refEmail', 'Please enter a valid email address'); });
      ifSet(aData.refPhone, () => { if (!ausPhoneOk(aData.refPhone)) pe(errors, 'refPhone', 'Please enter a valid Australian phone number'); });
      break;

    case 'c1personal': validatePersonalFormat(errors, 'c1', aData); break;
    case 'c2personal': validatePersonalFormat(errors, 'c2', aData); break;

    case 'c1property':
    case 'c1financial':
    case 'c1super':
    case 'c1liabilities':
      validateFinancialFormat(errors, 'c1', aData); break;

    case 'c2property':
    case 'c2financial':
    case 'c2super':
    case 'c2liabilities':
      validateFinancialFormat(errors, 'c2', aData); break;

    case 'c1smsf': validateSmsfFormat(errors, 'c1', bData); break;
    case 'c2smsf': validateSmsfFormat(errors, 'c2', bData); break;

    case 'advisors':
      ifSet(bData.accountantEmail, () => {
        if (bData.accountantEmail !== 'N/A' && !emailOk(bData.accountantEmail))
          pe(errors, 'accountantEmail', 'Please enter a valid email address');
      });
      ifSet(bData.accountantPhone, () => {
        if (bData.accountantPhone !== 'N/A' && !ausPhoneOk(bData.accountantPhone))
          pe(errors, 'accountantPhone', 'Please enter a valid Australian phone number');
      });
      break;

    case 'c1primary':     validateDistributionFormat(errors, cData.c1Scen1 || {}, 'c1Scen1'); break;
    case 'c1contingency': validateDistributionFormat(errors, cData.c1Scen2 || {}, 'c1Scen2'); break;
    case 'c2primary':     validateDistributionFormat(errors, cData.c2Scen1 || {}, 'c2Scen1'); break;
    case 'c2contingency': validateDistributionFormat(errors, cData.c2Scen2 || {}, 'c2Scen2'); break;

    case 'c1executors':
      validatePersonListFormat(errors, cData.c1Execs || [], parseInt(cData.c1ExecCount || 0), 'c1_executor'); break;
    case 'c2executors':
      validatePersonListFormat(errors, cData.c2Execs || [], parseInt(cData.c2ExecCount || 0), 'c2_executor'); break;
    case 'guardians':
      validatePersonListFormat(errors, cData.guardians || [], parseInt(cData.guardianCount || 0), 'guardian'); break;

    case 'c1epahealth':
      validatePersonListFormat(errors, dData.c1HealthAtts || [], parseInt(dData.c1HealthAttCount || 0), 'c1_health_att'); break;
    case 'c2epahealth':
      validatePersonListFormat(errors, dData.c2HealthAtts || [], parseInt(dData.c2HealthAttCount || 0), 'c2_health_att'); break;
    case 'c1epafin':
      validatePersonListFormat(errors, dData.c1FinAtts || [], parseInt(dData.c1FinAttCount || 0), 'c1_fin_att'); break;
    case 'c2epafin':
      validatePersonListFormat(errors, dData.c2FinAtts || [], parseInt(dData.c2FinAttCount || 0), 'c2_fin_att'); break;

    case 'declaration':
      ifSet(dData.c1SignDate, () => { if (!notFuture(dData.c1SignDate)) pe(errors, 'c1SignDate', 'Declaration date cannot be in the future'); });
      if (isCouple) ifSet(dData.c2SignDate, () => { if (!notFuture(dData.c2SignDate)) pe(errors, 'c2SignDate', 'Declaration date cannot be in the future'); });
      break;

    default:
      break;
  }

  return errors;
}
