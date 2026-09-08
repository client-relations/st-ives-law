import { useState } from 'react';
import Field from '../components/Field.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import SectionLabel from '../components/SectionLabel.jsx';
import InfoBox from '../components/InfoBox.jsx';
import AdviceBox from '../components/AdviceBox.jsx';
import PersonList from '../components/PersonList.jsx';
import DistributionScenario from '../components/DistributionScenario.jsx';
import { C } from '../constants/colors.js';
import { useValidation } from '../utils/useValidation.js';
import { validatePage } from '../utils/validation.js';

function hasMinorChildren(aData) {
  const today = new Date();
  const isMinor = (c) => {
    if (!c.dob) return false;
    return (today - new Date(c.dob)) / (1000 * 60 * 60 * 24 * 365.25) < 18;
  };
  if ((aData.childJoint || []).some(isMinor)) return true;
  if ((aData.c1Children || []).some(isMinor)) return true;
  if ((aData.c2Children || []).some(isMinor)) return true;
  return false;
}

export function usePartC(cData, setCData, aData) {
  const [pg, setPg] = useState(0);
  const [visited, setVisited] = useState(new Set([0]));
  const { errors, setErrors, hasError, getError, clearErrors } = useValidation();

  const isCouple = (aData.engType || '').startsWith('Couple');
  const showC2Dist = isCouple && cData.mirrorWill !== 'Yes — identical terms for both';
  const showGuardians = hasMinorChildren(aData);

  const allPages = [
    { key: 'welcome_c',      title: 'Welcome — Part C'              },
    ...(isCouple ? [{ key: 'willstructure', title: 'Will Structure' }] : []),
    { key: 'c1primary',      title: 'C1 — Distribution: Primary'    },
    { key: 'c1contingency',  title: 'C1 — Distribution: Contingency'},
    ...(showC2Dist ? [
      { key: 'c2primary',     title: 'C2 — Distribution: Primary'    },
      { key: 'c2contingency', title: 'C2 — Distribution: Contingency'},
    ] : []),
    { key: 'benefprofiles',  title: 'Beneficiary Profiles'          },
    { key: 'c1executors',    title: 'C1 — Executors'                },
    ...(isCouple ? [{ key: 'c2executors', title: 'C2 — Executors' }] : []),
    ...(showGuardians ? [{ key: 'guardians', title: 'Guardians' }] : []),
    { key: 'existingwills',  title: 'Existing Wills'                },
    { key: 'partCdone',      title: '✦ Part C Complete'             },
  ];

  const safePg = Math.min(pg, allPages.length - 1);
  const title = allPages[safePg]?.title || '';

  const goTo = (idx) => {
    clearErrors();
    setPg(idx);
    setVisited(v => new Set([...v, idx]));
  };

  const u = (data) => setCData(data);
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

  function getAllBeneficiaries() {
    const names = new Map();
    const addFrom = (scen) => {
      if (!scen) return;
      (scen.gifts || []).forEach(g => {
        const k = `${g.bFirst} ${g.bLast}`.trim();
        if (k && k !== ' ') names.set(k, k);
      });
      (scen.resBenes || []).forEach(r => {
        const k = `${r.first} ${r.last}`.trim();
        if (k && k !== ' ') names.set(k, k);
      });
    };
    addFrom(cData.c1Scen1); addFrom(cData.c1Scen2);
    addFrom(cData.c2Scen1); addFrom(cData.c2Scen2);
    return Array.from(names.keys());
  }

  function renderPage() {
    const key = allPages[safePg]?.key;
    const c1Name = aData.c1?.first || 'Client 1';
    const c2Name = aData.c2?.first || 'Client 2';

    switch (key) {
      case 'welcome_c': return (
        <>
          <SectionHeader icon="📝" title="Part C — Wills, Beneficiaries & Executors" />
          <InfoBox>This section covers the distribution of your estate, the appointment of executors, and any existing Will arrangements.</InfoBox>
        </>
      );

      case 'willstructure': return (
        <>
          <SectionHeader icon="📄" title="Will Structure" sub="For couples: how would you like your Wills to be structured?" />
          <AdviceBox title="Mirror Wills — Important Limitations">
            <p>Mirror Wills leave everything to each other, then to the same beneficiaries. While simple, a surviving spouse can change their Will after the first death. Mutual Wills may provide more certainty. Please discuss this with us.</p>
          </AdviceBox>
          <Field label="Will structure preference" type="radio"
            opts={['Yes — identical terms for both', 'No — different terms for each', 'Unsure — please advise']}
            value={cData.mirrorWill} onChange={v => u({ ...cData, mirrorWill: v })} required error={ge('mirrorWill')} />
        </>
      );

      case 'c1primary': return (
        <>
          <SectionHeader icon="🎁" title={`${c1Name} — Primary Distribution`} />
          <InfoBox>This is your first choice. For example, if you have a spouse, and you are making a provision where that spouse survives you – this Primary Distribution applies if that spouse survives you. In the next section we will discuss what happens if your preferred beneficiary (for example, your spouse), does not survive you.</InfoBox>
          <DistributionScenario D={cData.c1Scen1 || {}} update={v => u({ ...cData, c1Scen1: v })}
            prefix="c1Scen1" scenLabel={isCouple ? `If ${c2Name} survives ${c1Name}` : 'Primary distribution'}
            getError={ge} />
        </>
      );

      case 'c1contingency': return (
        <>
          <SectionHeader icon="🔄" title={`${c1Name} — Contingency Distribution`} />
          <InfoBox>This is your back up choice, if all of the persons you wished to make provision for in the Primary Distribution did not survive you. For example, if you wanted your estate to pass to your spouse in the Primary Distribution, but if they did not survive, then to your children – then in this scenario, your children are the persons you will list as the residuary beneficiaries below.</InfoBox>
          <DistributionScenario D={cData.c1Scen2 || {}} update={v => u({ ...cData, c1Scen2: v })}
            prefix="c1Scen2" scenLabel={isCouple ? `If ${c2Name} does NOT survive ${c1Name}` : 'If primary beneficiaries do not survive'}
            getError={ge} />
        </>
      );

      case 'c2primary': return (
        <>
          <SectionHeader icon="🎁" title={`${c2Name} — Primary Distribution`} />
          <InfoBox>This is your first choice. For example, if you have a spouse, and you are making a provision where that spouse survives you – this Primary Distribution applies if that spouse survives you. In the next section we will discuss what happens if your preferred beneficiary (for example, your spouse), does not survive you.</InfoBox>
          <DistributionScenario D={cData.c2Scen1 || {}} update={v => u({ ...cData, c2Scen1: v })}
            prefix="c2Scen1" scenLabel={`If ${c1Name} survives ${c2Name}`} getError={ge} />
        </>
      );

      case 'c2contingency': return (
        <>
          <SectionHeader icon="🔄" title={`${c2Name} — Contingency Distribution`} />
          <InfoBox>This is your back up choice, if all of the persons you wished to make provision for in the Primary Distribution did not survive you. For example, if you wanted your estate to pass to your spouse in the Primary Distribution, but if they did not survive, then to your children – then in this scenario, your children are the persons you will list as the residuary beneficiaries below.</InfoBox>
          <DistributionScenario D={cData.c2Scen2 || {}} update={v => u({ ...cData, c2Scen2: v })}
            prefix="c2Scen2" scenLabel={`If ${c1Name} does NOT survive ${c2Name}`} getError={ge} />
        </>
      );

      case 'benefprofiles': {
        const beneNames = getAllBeneficiaries();
        const profiles = cData.beneProfiles || {};
        const updateProfile = (name, field, val) => {
          u({ ...cData, beneProfiles: { ...profiles, [name]: { ...profiles[name], [field]: val } } });
        };
        return (
          <>
            <SectionHeader icon="👥" title="Beneficiary Profiles" sub="Financial maturity assessment" />
            <AdviceBox title="What is a Testamentary Trust?">
              <p>A Testamentary Trust is an estate planning tool in your Will which enables the inheritance of a person to be structured in a manner which can provide tax benefits, asset protection and third party managed distributions to young or vulnerable beneficiaries.</p>
            </AdviceBox>
            {beneNames.length === 0 && (
              <InfoBox>No beneficiaries named yet. Please complete the distribution pages before filling in beneficiary profiles.</InfoBox>
            )}
            {beneNames.map(name => (
              <div key={name} style={{ border: `1px solid ${C.bgBorder}`, borderRadius: 6, padding: '14px 16px', marginBottom: 12, background: C.bg }}>
                <SectionLabel text={name} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0 16px' }}>
                  <Field label="Financial maturity" type="select"
                    opts={['High — capable of managing a large inheritance', 'Moderate — may benefit from staged distributions', 'Low — likely to need protection', 'At risk occupation', 'Minor — under 18', 'Unknown / To discuss']}
                    value={profiles[name]?.literacy || ''} onChange={v => updateProfile(name, 'literacy', v)}
                    error={ge(`bene_${name}_literacy`)} />
                  <Field label="Would you like protection for their inheritance in the form of a trust?" type="radio" opts={['Yes', 'No', 'To discuss']}
                    name={`bene_tt_${name.replace(/\s+/g, '_').toLowerCase()}`}
                    value={profiles[name]?.needsTT || ''} onChange={v => updateProfile(name, 'needsTT', v)}
                    error={ge(`bene_${name}_needsTT`)} />
                </div>
              </div>
            ))}
          </>
        );
      }

      case 'c1executors': {
        const D = { count: parseInt(cData.c1ExecCount || 0), list: cData.c1Execs || [] };
        return (
          <>
            <SectionHeader icon="⚖️" title={`${c1Name} — Executors`} />
            <InfoBox>Your executor is the person responsible for administering your estate. Recommend at least two executors.</InfoBox>
            <PersonList countLabel="Number of executors" D={D}
              update={v => u({ ...cData, c1ExecCount: String(v.count), c1Execs: v.list })}
              noun="Executor" nounKey="c1_executor" showAgreed showAddr
              countError={ge('c1ExecCount') || ge('c1ExecCount_min')} getError={ge} />
            <Field label="Preferred Will storage location" type="select"
              opts={['With St Ives Law', 'At home (safe/lockbox)', 'With my bank', 'With another solicitor', 'Other']}
              value={cData.c1WillLoc} onChange={v => u({ ...cData, c1WillLoc: v })} required error={ge('c1WillLoc')} />
          </>
        );
      }

      case 'c2executors': {
        const D = { count: parseInt(cData.c2ExecCount || 0), list: cData.c2Execs || [] };
        return (
          <>
            <SectionHeader icon="⚖️" title={`${c2Name} — Executors`} />
            <InfoBox>These may be the same persons as {c1Name}'s executors or different.</InfoBox>
            <PersonList countLabel="Number of executors" D={D}
              update={v => u({ ...cData, c2ExecCount: String(v.count), c2Execs: v.list })}
              noun="Executor" nounKey="c2_executor" showAgreed showAddr
              countError={ge('c2ExecCount') || ge('c2ExecCount_min')} getError={ge} />
            <Field label="Preferred Will storage location" type="select"
              opts={['With St Ives Law', 'At home (safe/lockbox)', 'With my bank', 'With another solicitor', 'Other']}
              value={cData.c2WillLoc} onChange={v => u({ ...cData, c2WillLoc: v })} required error={ge('c2WillLoc')} />
          </>
        );
      }

      case 'guardians': {
        const D = { count: parseInt(cData.guardianCount || 0), list: cData.guardians || [] };
        return (
          <>
            <SectionHeader icon="👨‍👧" title="Guardians for Minor Children" />
            <InfoBox>A guardian is the person who will care for your minor children if both parents are deceased. Please discuss this with the nominated persons first.</InfoBox>
            <PersonList countLabel="Number of guardians" D={D}
              update={v => u({ ...cData, guardianCount: String(v.count), guardians: v.list })}
              noun="Guardian" nounKey="guardian" showAgreed showAddr
              countError={ge('guardianCount') || ge('guardianCount_min')} getError={ge} />
          </>
        );
      }

      case 'existingwills': return (
        <>
          <SectionHeader icon="📂" title="Existing Wills" />
          <SectionLabel text={c1Name} />
          <Field label={`Does ${c1Name} have an existing Will?`} type="radio" opts={['Yes', 'No']}
            value={cData.c1HasExistingWill} onChange={v => u({ ...cData, c1HasExistingWill: v })} required error={ge('c1HasExistingWill')} />
          {cData.c1HasExistingWill === 'Yes' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0 16px' }}>
              <Field label="Approximate date of existing Will" type="date" value={cData.c1WillDate}
                onChange={v => u({ ...cData, c1WillDate: v })} required error={ge('c1WillDate')} />
              <Field label="Where is the existing Will kept?" type="select"
                opts={['At home', 'With a solicitor', 'With a bank', 'With a registry', 'Unknown']}
                value={cData.c1WillKept} onChange={v => u({ ...cData, c1WillKept: v })} required error={ge('c1WillKept')} />
            </div>
          )}
          {isCouple && (
            <>
              <SectionLabel text={c2Name} />
              <Field label={`Does ${c2Name} have an existing Will?`} type="radio" opts={['Yes', 'No']}
                value={cData.c2HasExistingWill} onChange={v => u({ ...cData, c2HasExistingWill: v })} required error={ge('c2HasExistingWill')} />
              {cData.c2HasExistingWill === 'Yes' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0 16px' }}>
                  <Field label="Approximate date" type="date" value={cData.c2WillDate}
                    onChange={v => u({ ...cData, c2WillDate: v })} required error={ge('c2WillDate')} />
                  <Field label="Where is it kept?" type="select"
                    opts={['At home', 'With a solicitor', 'With a bank', 'With a registry', 'Unknown']}
                    value={cData.c2WillKept} onChange={v => u({ ...cData, c2WillKept: v })} required error={ge('c2WillKept')} />
                </div>
              )}
            </>
          )}
        </>
      );

      case 'partCdone': return (
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ background: C.greenL, border: `1px solid ${C.green}`, borderRadius: 8, padding: '28px 32px', display: 'inline-block', maxWidth: 480, textAlign: 'left' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
            <h3 style={{ fontFamily: C.fontHeading, color: C.green, margin: '0 0 10px', fontWeight: 'normal', fontSize: 20 }}>Part C Complete</h3>
            <p style={{ fontFamily: C.fontBody, fontSize: 14, color: C.text, margin: 0, lineHeight: 1.6 }}>
              You have completed Part C — Wills &amp; Executors. Click <strong>Proceed</strong> to continue with Part D.
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
