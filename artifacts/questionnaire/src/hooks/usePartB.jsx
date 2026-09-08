import { useState } from 'react';
import Field from '../components/Field.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import SectionLabel from '../components/SectionLabel.jsx';
import InfoBox from '../components/InfoBox.jsx';
import AdviceBox from '../components/AdviceBox.jsx';
import { C } from '../constants/colors.js';
import { useValidation } from '../utils/useValidation.js';
import { validatePage } from '../utils/validation.js';

function newItem(fields) {
  return { id: Date.now().toString(36) + Math.random().toString(36).slice(2), ...fields };
}

const BUSINESS_STRUCTURES = ['Sole Trader', 'Partnership', 'Company (Pty Ltd)', 'Company (Ltd)', 'Trust', 'Other'];
const TRUST_TYPES = ['Discretionary (Family) Trust', 'Unit Trust', 'Hybrid Trust', 'Testamentary Trust', 'Other'];

export function usePartB(bData, setBData, aData) {
  const [pg, setPg] = useState(0);
  const [visited, setVisited] = useState(new Set([0]));
  const { errors, setErrors, hasError, getError, clearErrors } = useValidation();
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState(null);

  const isCouple = (aData.engType || '').startsWith('Couple');
  const c1HasIns = bData.c1HasIns === 'Yes';
  const c2HasIns = bData.c2HasIns === 'Yes';

  const allPages = [
    { key: 'welcome_b',    title: 'Welcome — Part B'         },
    { key: 'c1companies',  title: 'C1 — Companies'           },
    { key: 'c1biz',        title: 'C1 — Business Interests'  },
    { key: 'c1trusts',     title: 'C1 — Trusts'              },
    { key: 'c1smsf',       title: 'C1 — SMSF'                },
    ...(isCouple ? [
      { key: 'c2companies', title: 'C2 — Companies'          },
      { key: 'c2biz',       title: 'C2 — Business Interests' },
      { key: 'c2trusts',    title: 'C2 — Trusts'             },
      { key: 'c2smsf',      title: 'C2 — SMSF'               },
    ] : []),
    { key: 'insurance',    title: 'Insurance Overview'       },
    ...(c1HasIns ? [
      { key: 'c1lifetpd',  title: 'C1 — Life & TPD'                },
      { key: 'c1traumaip', title: 'C1 — Trauma & Income Protection' },
    ] : []),
    ...(isCouple && c2HasIns ? [
      { key: 'c2lifetpd',  title: 'C2 — Life & TPD'                },
      { key: 'c2traumaip', title: 'C2 — Trauma & Income Protection' },
    ] : []),
    { key: 'advisors',     title: 'Professional Advisors'    },
    { key: 'documents',    title: 'Document Upload'          },
    { key: 'partBdone',    title: '✦ Part B Complete'        },
  ];

  const safePg = Math.min(pg, allPages.length - 1);
  const title = allPages[safePg]?.title || '';

  const goTo = (idx) => {
    clearErrors();
    setPg(idx);
    setVisited(v => new Set([...v, idx]));
  };

  const u = (data) => setBData(data);
  const ge = getError;

  const handleNext = (aD, bD, cD, dD) => {
    const pageErrors = validatePage(allPages[safePg]?.key || '', aD, bD, cD, dD);
    if (pageErrors.length > 0) {
      setErrors(pageErrors);
      document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
      return false;
    }
    clearErrors();
    setPg(p => p + 1);
    setVisited(v => new Set([...v, safePg + 1]));
    return true;
  };

  function renderCompanies(px, label) {
    const companies = bData[`${px}Companies`] || [];
    const setCount = (n) => {
      const c = Math.max(0, Math.min(20, parseInt(n, 10) || 0));
      let arr = [...companies];
      while (arr.length < c) arr.push(newItem({ name: '', directors: '', shareholders: '', activity: '', netValue: '', hasDebt: '', debtDetail: '' }));
      arr = arr.slice(0, c);
      u({ ...bData, [`${px}CompanyCount`]: c, [`${px}Companies`]: arr });
    };
    const upCo = (i, k, v) => u({ ...bData, [`${px}Companies`]: companies.map((c, j) => j === i ? { ...c, [k]: v } : c) });
    return (
      <>
        <SectionHeader icon="🏢" title={label} />
        <Field label="How many companies do you have?" type="number" value={bData[`${px}CompanyCount`] ?? ''}
          onChange={setCount} placeholder="Enter 0 if none" error={ge(`${px}CompanyCount`)} />
        {companies.map((co, idx) => (
          <div key={co.id} style={{ border: `1px solid ${C.bgBorder}`, borderRadius: 6, padding: '14px 16px', marginBottom: 12, background: C.bg }}>
            <SectionLabel text={`Company ${idx + 1}`} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0 16px' }}>
              <Field label="Company name" value={co.name} onChange={v => upCo(idx, 'name', v)} error={ge(`${px}_company_${idx}_name`)} />
              <Field label="What does the company do?" type="select"
                opts={['Investment', 'Trading', 'Trustee Company']}
                value={co.activity} onChange={v => upCo(idx, 'activity', v)} error={ge(`${px}_company_${idx}_activity`)} />
              <Field label="Net asset value ($)" value={co.netValue} onChange={v => upCo(idx, 'netValue', v)}
                placeholder="e.g. 500,000" error={ge(`${px}_company_${idx}_netValue`)} />
            </div>
            <Field label="Directors (list all names)" type="textarea" rows={2} value={co.directors}
              onChange={v => upCo(idx, 'directors', v)} placeholder="e.g. John Smith, Jane Smith"
              error={ge(`${px}_company_${idx}_directors`)} />
            <Field label="Shareholders (names and shareholding)" type="textarea" rows={2} value={co.shareholders}
              onChange={v => upCo(idx, 'shareholders', v)} placeholder="e.g. John Smith 50%, Jane Smith 50%"
              error={ge(`${px}_company_${idx}_shareholders`)} />
            <Field label="Does the company have any debt?" type="radio" opts={['Yes', 'No']}
              name={`${px}_co_${idx}_debt`}
              value={co.hasDebt} onChange={v => upCo(idx, 'hasDebt', v)} error={ge(`${px}_company_${idx}_hasDebt`)} />
            {co.hasDebt === 'Yes' && (
              <Field label="Please describe the debt" type="textarea" rows={2} value={co.debtDetail}
                onChange={v => upCo(idx, 'debtDetail', v)} error={ge(`${px}_company_${idx}_debtDetail`)} />
            )}
          </div>
        ))}
      </>
    );
  }

  function renderBiz(px, label) {
    const bizList = bData[`${px}Businesses`] || [];
    const setCount = (n) => {
      const c = Math.max(0, Math.min(20, parseInt(n, 10) || 0));
      let arr = [...bizList];
      while (arr.length < c) arr.push(newItem({ name: '', structure: '', acn: '', netValue: '' }));
      arr = arr.slice(0, c);
      u({ ...bData, [`${px}BizCount`]: c, [`${px}Businesses`]: arr });
    };
    const upBiz = (i, k, v) => u({ ...bData, [`${px}Businesses`]: bizList.map((b, j) => j === i ? { ...b, [k]: v } : b) });
    return (
      <>
        <SectionHeader icon="💼" title={label} />
        <Field label="Do you have any other business interests (sole trader, partnership, etc.)?" type="radio" opts={['Yes', 'No']}
          name={`${px}_has_biz`}
          value={bData[`${px}HasBiz`]} onChange={v => u({ ...bData, [`${px}HasBiz`]: v })} error={ge(`${px}HasBiz`)} />
        {bData[`${px}HasBiz`] === 'Yes' && (
          <>
            <Field label="Number of businesses" type="number" value={bData[`${px}BizCount`] ?? ''}
              onChange={setCount} error={ge(`${px}BizCount`)} />
            {bizList.map((biz, idx) => (
              <div key={biz.id} style={{ border: `1px solid ${C.bgBorder}`, borderRadius: 6, padding: '14px 16px', marginBottom: 12, background: C.bg }}>
                <SectionLabel text={`Business ${idx + 1}`} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0 16px' }}>
                  <Field label="Business Name" value={biz.name} onChange={v => upBiz(idx, 'name', v)} error={ge(`business_${idx}_name`)} />
                  <Field label="Structure" type="select" opts={BUSINESS_STRUCTURES} value={biz.structure} onChange={v => upBiz(idx, 'structure', v)} error={ge(`business_${idx}_structure`)} />
                  <Field label="ACN / ABN" value={biz.acn} onChange={v => upBiz(idx, 'acn', v)} error={ge(`business_${idx}_acn`)} />
                  <Field label="Net Value ($)" value={biz.netValue} onChange={v => upBiz(idx, 'netValue', v)} error={ge(`business_${idx}_netValue`)} />
                </div>
              </div>
            ))}
          </>
        )}
      </>
    );
  }

  function renderTrusts(px, label) {
    const trustList = bData[`${px}Trusts`] || [];
    const setCount = (n) => {
      const c = Math.max(0, Math.min(20, parseInt(n, 10) || 0));
      let arr = [...trustList];
      while (arr.length < c) arr.push(newItem({ name: '', type: '', trusteeName: '', trusteeType: '', activity: '', netValue: '', hasDebt: '', debtDetail: '' }));
      arr = arr.slice(0, c);
      u({ ...bData, [`${px}TrustCount`]: c, [`${px}Trusts`]: arr });
    };
    const upTrust = (i, k, v) => u({ ...bData, [`${px}Trusts`]: trustList.map((t, j) => j === i ? { ...t, [k]: v } : t) });
    return (
      <>
        <SectionHeader icon="⚖️" title={label} />
        <AdviceBox title="Trust Control on Death">
          <p>Control of a discretionary trust does not automatically pass to your estate. The succession of the trustee or appointor role must be addressed in your estate plan.</p>
        </AdviceBox>
        <Field label="Are you involved in any trusts?" type="radio" opts={['Yes', 'No']}
          name={`${px}_has_trusts`}
          value={bData[`${px}HasTrusts`]} onChange={v => u({ ...bData, [`${px}HasTrusts`]: v })} error={ge(`${px}HasTrusts`)} />
        {bData[`${px}HasTrusts`] === 'Yes' && (
          <>
            <Field label="Number of trusts" type="number" value={bData[`${px}TrustCount`] ?? ''}
              onChange={setCount} error={ge(`${px}TrustCount`)} />
            {trustList.map((trust, idx) => (
              <div key={trust.id} style={{ border: `1px solid ${C.bgBorder}`, borderRadius: 6, padding: '14px 16px', marginBottom: 12, background: C.bg }}>
                <SectionLabel text={`Trust ${idx + 1}`} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0 16px' }}>
                  <Field label="Trust Name" value={trust.name} onChange={v => upTrust(idx, 'name', v)} error={ge(`trust_${idx}_name`)} />
                  <Field label="Trust Type" type="select" opts={TRUST_TYPES} value={trust.type} onChange={v => upTrust(idx, 'type', v)} error={ge(`trust_${idx}_type`)} />
                  <Field label="Name of trustee" value={trust.trusteeName} onChange={v => upTrust(idx, 'trusteeName', v)} error={ge(`trust_${idx}_trusteeName`)} />
                  <Field label="Is the trustee a Company or Natural Person(s)?" type="select"
                    opts={['Company', 'Natural Person(s)']}
                    value={trust.trusteeType} onChange={v => upTrust(idx, 'trusteeType', v)} error={ge(`trust_${idx}_trusteeType`)} />
                  <Field label="What does the trust do?" type="select" opts={['Investment', 'Trading']}
                    value={trust.activity} onChange={v => upTrust(idx, 'activity', v)} error={ge(`trust_${idx}_activity`)} />
                  <Field label="Net Asset Value ($)" value={trust.netValue} onChange={v => upTrust(idx, 'netValue', v)} error={ge(`trust_${idx}_netValue`)} />
                </div>
                <Field label="Does the trust have any debt?" type="radio" opts={['Yes', 'No']}
                  name={`${px}_trust_${idx}_debt`}
                  value={trust.hasDebt} onChange={v => upTrust(idx, 'hasDebt', v)} error={ge(`trust_${idx}_hasDebt`)} />
                {trust.hasDebt === 'Yes' && (
                  <Field label="Please describe the debt" type="textarea" rows={2} value={trust.debtDetail}
                    onChange={v => upTrust(idx, 'debtDetail', v)} error={ge(`trust_${idx}_debtDetail`)} />
                )}
              </div>
            ))}
          </>
        )}
      </>
    );
  }

  function renderSmsf(px, label) {
    const smsfList = bData[`${px}SmsfList`] || [];
    const setCount = (n) => {
      const c = Math.max(0, Math.min(10, parseInt(n, 10) || 0));
      let arr = [...smsfList];
      while (arr.length < c) arr.push(newItem({ name: '', trusteeName: '', trusteeType: '', memberCount: 0, members: [], totalValue: '', hasLrba: '', lrbaAsset: '', lrbaAmount: '', lrbaLender: '' }));
      arr = arr.slice(0, c);
      u({ ...bData, [`${px}SmsfCount`]: c, [`${px}SmsfList`]: arr });
    };
    const upSmsf = (i, k, v) => u({ ...bData, [`${px}SmsfList`]: smsfList.map((s, j) => j === i ? { ...s, [k]: v } : s) });
    return (
      <>
        <SectionHeader icon="🏛" title={label} />
        <Field label="Do you have a Self-Managed Superannuation Fund (SMSF)?" type="radio" opts={['Yes', 'No']}
          name={`${px}_has_smsf`}
          value={bData[`${px}HasSmsf`]} onChange={v => u({ ...bData, [`${px}HasSmsf`]: v })} error={ge(`${px}HasSmsf`)} />
        {bData[`${px}HasSmsf`] === 'Yes' && (
          <>
            <Field label="How many SMSFs?" type="number" value={bData[`${px}SmsfCount`] ?? ''}
              onChange={setCount} placeholder="Enter 0 if none" error={ge(`${px}SmsfCount`)} />
            {smsfList.map((smsf, idx) => (
              <div key={smsf.id} style={{ border: `1px solid ${C.bgBorder}`, borderRadius: 6, padding: '14px 16px', marginBottom: 12, background: C.bg }}>
                <SectionLabel text={`SMSF ${idx + 1}`} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0 16px' }}>
                  <Field label="Name of the SMSF" value={smsf.name} onChange={v => upSmsf(idx, 'name', v)} error={ge(`smsf_${idx}_name`)} />
                  <Field label="Name of trustee" value={smsf.trusteeName} onChange={v => upSmsf(idx, 'trusteeName', v)} error={ge(`smsf_${idx}_trusteeName`)} />
                  <Field label="Is the trustee a Company or Natural Person(s)?" type="select"
                    opts={['Company', 'Natural Person(s)']}
                    value={smsf.trusteeType} onChange={v => upSmsf(idx, 'trusteeType', v)} error={ge(`smsf_${idx}_trusteeType`)} />
                  <Field label="Approximate total value ($)" value={smsf.totalValue} onChange={v => upSmsf(idx, 'totalValue', v)}
                    placeholder="e.g. 1,200,000" error={ge(`smsf_${idx}_totalValue`)} />
                </div>
                <SectionLabel text="Members" />
                <Field label="Number of members" type="number" value={smsf.memberCount || ''}
                  onChange={v => {
                    const mc = Math.max(0, Math.min(10, parseInt(v, 10) || 0));
                    const members = Array.from({ length: mc }, (_, i) => (smsf.members || [])[i] || '');
                    const newList = smsfList.map((s, j) => j === idx ? { ...s, memberCount: mc, members } : s);
                    u({ ...bData, [`${px}SmsfList`]: newList });
                  }}
                  error={ge(`smsf_${idx}_memberCount`)} />
                {Array.from({ length: parseInt(smsf.memberCount || 0) }, (_, mi) => (
                  <Field key={mi} label={`Member ${mi + 1} — Full name`}
                    value={(smsf.members || [])[mi] || ''}
                    onChange={v => {
                      const members = [...(smsf.members || [])];
                      members[mi] = v;
                      const newList = smsfList.map((s, j) => j === idx ? { ...s, members } : s);
                      u({ ...bData, [`${px}SmsfList`]: newList });
                    }}
                    error={ge(`smsf_${idx}_member_${mi}`)} />
                ))}
                <SectionLabel text="Limited Recourse Borrowing Arrangement (LRBA)" />
                <Field label="Does the SMSF have an LRBA?" type="radio" opts={['Yes', 'No']}
                  name={`${px}_smsf_${idx}_lrba`}
                  value={smsf.hasLrba} onChange={v => upSmsf(idx, 'hasLrba', v)} error={ge(`smsf_${idx}_hasLrba`)} />
                {smsf.hasLrba === 'Yes' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0 16px' }}>
                    <Field label="Over what asset?" value={smsf.lrbaAsset} onChange={v => upSmsf(idx, 'lrbaAsset', v)} error={ge(`smsf_${idx}_lrbaAsset`)} />
                    <Field label="How much is the borrowing ($)?" value={smsf.lrbaAmount} onChange={v => upSmsf(idx, 'lrbaAmount', v)} error={ge(`smsf_${idx}_lrbaAmount`)} />
                    <Field label="Who is the lender?" value={smsf.lrbaLender} onChange={v => upSmsf(idx, 'lrbaLender', v)} error={ge(`smsf_${idx}_lrbaLender`)} />
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </>
    );
  }

  function renderLifeTPD(px, label) {
    const policies = bData[`${px}Life`] || [];
    const setCount = (n) => {
      const c = Math.max(0, Math.min(20, parseInt(n, 10) || 0));
      let arr = [...policies];
      while (arr.length < c) arr.push(newItem({ insurer: '', cover: '', heldInSuper: '', beneFixed: '' }));
      arr = arr.slice(0, c);
      u({ ...bData, [`${px}LifeCount`]: c, [`${px}Life`]: arr });
    };
    const upPolicy = (i, k, v) => u({ ...bData, [`${px}Life`]: policies.map((p, j) => j === i ? { ...p, [k]: v } : p) });
    return (
      <>
        <SectionHeader icon="📜" title={label} />
        <Field label="Number of Life / TPD policies (enter 0 if none)" type="number"
          value={bData[`${px}LifeCount`] ?? ''} onChange={setCount} error={ge(`${px}LifeCount`)} />
        {policies.map((policy, idx) => (
          <div key={policy.id} style={{ border: `1px solid ${C.bgBorder}`, borderRadius: 6, padding: '14px 16px', marginBottom: 12, background: C.bg }}>
            <SectionLabel text={`Policy ${idx + 1}`} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0 16px' }}>
              <Field label="Insurer" value={policy.insurer} onChange={v => upPolicy(idx, 'insurer', v)} error={ge(`life_policy_${idx}_insurer`)} />
              <Field label="Sum Insured ($)" value={policy.cover} onChange={v => upPolicy(idx, 'cover', v)} error={ge(`life_policy_${idx}_cover`)} />
              <Field label="Held inside super?" type="select" opts={['Yes', 'No', 'Partially']} value={policy.heldInSuper} onChange={v => upPolicy(idx, 'heldInSuper', v)} error={ge(`life_policy_${idx}_heldInSuper`)} />
              <Field label="Binding nomination?" type="select" opts={['Yes — Lapsing', 'Yes — Non-Lapsing', 'No', 'Unsure']} value={policy.beneFixed} onChange={v => upPolicy(idx, 'beneFixed', v)} error={ge(`life_policy_${idx}_beneFixed`)} />
            </div>
          </div>
        ))}
      </>
    );
  }

  function renderPage() {
    const key = allPages[safePg]?.key;
    switch (key) {
      case 'welcome_b': return (
        <>
          <SectionHeader icon="💼" title="Part B — Companies, Business, Trusts, SMSFs & Insurance" />
          <InfoBox>This section covers your companies, business interests, trusts, self-managed superannuation funds, and personal insurance policies.</InfoBox>
        </>
      );
      case 'c1companies':  return renderCompanies('c1', 'Client 1 — Companies');
      case 'c1biz':        return renderBiz('c1', 'Client 1 — Business Interests');
      case 'c1trusts':     return renderTrusts('c1', 'Client 1 — Trusts');
      case 'c1smsf':       return renderSmsf('c1', 'Client 1 — SMSF');
      case 'c2companies':  return renderCompanies('c2', 'Client 2 — Companies');
      case 'c2biz':        return renderBiz('c2', 'Client 2 — Business Interests');
      case 'c2trusts':     return renderTrusts('c2', 'Client 2 — Trusts');
      case 'c2smsf':       return renderSmsf('c2', 'Client 2 — SMSF');
      case 'insurance': return (
        <>
          <SectionHeader icon="🛡" title="Insurance Overview" />
          <InfoBox>Life insurance, TPD, trauma, and income protection policies may impact your estate planning. Policies inside super are dealt with through your BDBN.</InfoBox>
          <Field label={`Does ${aData.c1?.first || 'Client 1'} have any life insurance, TPD, trauma or income protection?`}
            type="radio" opts={['Yes', 'No']} name="c1_has_ins"
            value={bData.c1HasIns} onChange={v => u({ ...bData, c1HasIns: v })} error={ge('c1HasIns')} />
          {isCouple && (
            <Field label={`Does ${aData.c2?.first || 'Client 2'} have any life insurance, TPD, trauma or income protection?`}
              type="radio" opts={['Yes', 'No']} name="c2_has_ins"
              value={bData.c2HasIns} onChange={v => u({ ...bData, c2HasIns: v })} error={ge('c2HasIns')} />
          )}
        </>
      );
      case 'c1lifetpd':  return renderLifeTPD('c1', 'Client 1 — Life & TPD');
      case 'c1traumaip': return (
        <>
          <SectionHeader icon="🏥" title="Client 1 — Trauma & Income Protection" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0 16px' }}>
            <Field label="Number of Trauma policies (enter 0 if none)" type="number"
              value={bData.c1TraumaCount ?? ''} onChange={v => u({ ...bData, c1TraumaCount: v })} error={ge('c1TraumaCount')} />
            <Field label="Number of Income Protection policies (enter 0 if none)" type="number"
              value={bData.c1IncomeCount ?? ''} onChange={v => u({ ...bData, c1IncomeCount: v })} error={ge('c1IncomeCount')} />
          </div>
        </>
      );
      case 'c2lifetpd':  return renderLifeTPD('c2', 'Client 2 — Life & TPD');
      case 'c2traumaip': return (
        <>
          <SectionHeader icon="🏥" title="Client 2 — Trauma & Income Protection" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0 16px' }}>
            <Field label="Number of Trauma policies (enter 0 if none)" type="number"
              value={bData.c2TraumaCount ?? ''} onChange={v => u({ ...bData, c2TraumaCount: v })} error={ge('c2TraumaCount')} />
            <Field label="Number of Income Protection policies (enter 0 if none)" type="number"
              value={bData.c2IncomeCount ?? ''} onChange={v => u({ ...bData, c2IncomeCount: v })} error={ge('c2IncomeCount')} />
          </div>
        </>
      );
      case 'advisors': return (
        <>
          <SectionHeader icon="👔" title="Professional Advisors" />
          <InfoBox>Providing your accountant's details allows us to coordinate with them if required, with your authority.</InfoBox>
          <SectionLabel text="Accountant" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0 16px' }}>
            <Field label="Accountant Name / Firm" value={bData.accountant} onChange={v => u({ ...bData, accountant: v })}
              placeholder="Enter name, or 'None' if not applicable" error={ge('accountant')} />
            <Field label="Phone" type="tel" value={bData.accountantPhone} onChange={v => u({ ...bData, accountantPhone: v })}
              placeholder="Enter phone, or 'N/A'" error={ge('accountantPhone')} />
            <Field label="Email" type="email" value={bData.accountantEmail} onChange={v => u({ ...bData, accountantEmail: v })}
              placeholder="Enter email, or 'N/A'" error={ge('accountantEmail')} />
          </div>
          <Field label="Do you authorise us to contact your accountant?" type="radio" name="accountant_authority"
            opts={['Yes', 'No', 'Ask me first']} value={bData.accountantAuthority}
            onChange={v => u({ ...bData, accountantAuthority: v })} error={ge('accountantAuthority')} />
        </>
      );
      case 'documents': {
        const files = bData.uploadedFiles || [];
        return (
          <>
            <SectionHeader icon="📎" title="Document Upload" sub="Please upload any relevant documents" />
            <InfoBox>
              <div style={{ marginBottom: 8 }}>Please upload any documents that may be relevant to your estate planning matter. This may include but is not limited to:</div>
              <ul style={{ margin: '0 0 8px 18px', padding: 0, lineHeight: 1.8 }}>
                <li><strong>Trust deeds</strong> — for any family, discretionary, unit or hybrid trusts you are involved in</li>
                <li><strong>Company constitutions</strong> — for any companies you own, direct or hold shares in</li>
                <li><strong>SMSF trust deeds</strong> — for any self-managed superannuation funds</li>
                <li><strong>Partnership agreements</strong> — if you operate a business in partnership with others</li>
                <li><strong>Existing Wills or Codicils</strong> — any current or previous Will documents</li>
                <li><strong>Existing Powers of Attorney</strong> — any current financial or health EPA documents</li>
                <li><strong>Binding Death Benefit Nominations (BDBNs)</strong> — for superannuation funds</li>
                <li><strong>Property title documents</strong> — if relevant to your estate planning</li>
                <li><strong>Shareholder or unitholder agreements</strong></li>
                <li><strong>Loan agreements or personal guarantee documents</strong></li>
                <li><strong>Any other documents</strong> you consider relevant to your matter</li>
              </ul>
              <div>You may also email these documents to us directly if you prefer.</div>
            </InfoBox>
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                cursor: uploading ? 'not-allowed' : 'pointer',
                padding: '10px 20px', background: C.teal, color: C.white, borderRadius: 6,
                fontFamily: C.fontBody, fontSize: 14, fontWeight: 600,
                opacity: uploading ? 0.65 : 1,
              }}>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
                  style={{ display: 'none' }}
                  disabled={uploading}
                  onChange={async e => {
                    const selected = Array.from(e.target.files || []);
                    e.target.value = '';
                    if (!selected.length) return;
                    setUploadErr(null);
                    setUploading(true);
                    try {
                      const formData = new FormData();
                      selected.forEach(f => formData.append('files', f));
                      const res = await fetch('/api/upload', { method: 'POST', body: formData });
                      const text = await res.text();
                      let data = null;
                      try { data = JSON.parse(text); } catch { data = null; }
                      if (!res.ok) {
                        throw new Error(data?.error || data?.detail || `Upload failed (server error ${res.status}). Please try again.`);
                      }
                      if (!data?.files) {
                        throw new Error('Upload failed — unexpected server response. Please try again or contact support.');
                      }
                      u({ ...bData, uploadedFiles: [...files, ...data.files] });
                    } catch (err) {
                      setUploadErr(err.message || 'Upload failed. Please try again.');
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
                {uploading ? '⏳ Uploading…' : '+ Add Files'}
              </label>
            </div>
            {uploadErr && (
              <div style={{
                color: C.red, fontFamily: C.fontBody, fontSize: 13,
                background: '#fdf2f2', border: `1px solid ${C.red}`,
                borderRadius: 5, padding: '8px 12px', marginBottom: 12,
              }}>
                ⚠ {uploadErr}
              </div>
            )}
            {files.length > 0 ? (
              <div>
                {files.map((f, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', border: `1px solid ${C.bgBorder}`, borderRadius: 5,
                    marginBottom: 6, background: C.bg, fontFamily: C.fontBody, fontSize: 13, color: C.text,
                  }}>
                    <span>📄 {typeof f === 'string' ? f : f.name}</span>
                    <button
                      onClick={() => u({ ...bData, uploadedFiles: files.filter((_, j) => j !== i) })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, fontSize: 18, lineHeight: 1, padding: '0 4px' }}
                    >×</button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: C.textL, fontFamily: C.fontBody, fontSize: 13, fontStyle: 'italic' }}>
                No files selected yet.
              </div>
            )}
          </>
        );
      }
      case 'partBdone': return (
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ background: C.greenL, border: `1px solid ${C.green}`, borderRadius: 8, padding: '28px 32px', display: 'inline-block', maxWidth: 480, textAlign: 'left' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
            <h3 style={{ fontFamily: C.fontHeading, color: C.green, margin: '0 0 10px', fontWeight: 'normal', fontSize: 20 }}>Part B Complete</h3>
            <p style={{ fontFamily: C.fontBody, fontSize: 14, color: C.text, margin: 0, lineHeight: 1.6 }}>
              You have completed Part B — Companies, Business, Trusts &amp; Insurance. Click <strong>Proceed</strong> to continue with Part C.
            </p>
          </div>
        </div>
      );
      default: return null;
    }
  }

  return {
    pages: allPages, pg: safePg, setPg: goTo, handleNext,
    total: allPages.length,
    pct: Math.round(((safePg + 1) / allPages.length) * 100),
    title, visited, renderPage,
    errors, hasError, getError, clearErrors,
  };
}
