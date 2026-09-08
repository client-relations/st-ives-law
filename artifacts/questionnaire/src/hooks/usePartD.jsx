import { useState } from 'react';
import Field from '../components/Field.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import SectionLabel from '../components/SectionLabel.jsx';
import InfoBox from '../components/InfoBox.jsx';
import AdviceBox from '../components/AdviceBox.jsx';
import PersonList from '../components/PersonList.jsx';
import { C } from '../constants/colors.js';
import { useValidation } from '../utils/useValidation.js';
import { validatePage } from '../utils/validation.js';

export function usePartD(dData, setDData, aData) {
  const [pg, setPg] = useState(0);
  const [visited, setVisited] = useState(new Set([0]));
  const { errors, setErrors, hasError, getError, clearErrors } = useValidation();

  const isCouple = (aData.engType || '').startsWith('Couple');
  const n1 = aData?.c1?.nick || aData?.c1?.first || 'Client 1';
  const n2 = aData?.c2?.nick || aData?.c2?.first || 'Client 2';

  const allPages = [
    { key: 'welcome_d',   title: 'Welcome — Part D'                    },
    { key: 'c1epahealth', title: `${n1} — Enduring Power of Attorney: Health & Personal` },
    { key: 'c1medical',   title: `${n1} — Medical & End of Life`                        },
    { key: 'c1epafin',    title: `${n1} — Enduring Power of Attorney: Financial`        },
    { key: 'c1funeral',   title: `${n1} — Funeral & Legacy Wishes`     },
    ...(isCouple ? [
      { key: 'c2epahealth', title: `${n2} — Enduring Power of Attorney: Health & Personal` },
      { key: 'c2medical',   title: `${n2} — Medical & End of Life`                        },
      { key: 'c2epafin',    title: `${n2} — Enduring Power of Attorney: Financial`        },
      { key: 'c2funeral',   title: `${n2} — Funeral & Legacy Wishes` },
    ] : []),
    { key: 'additional',  title: 'Additional Information' },
    { key: 'declaration', title: 'Declaration'            },
    { key: 'submit',      title: 'Submit'                 },
  ];

  const safePg = Math.min(pg, allPages.length - 1);
  const title = allPages[safePg]?.title || '';

  const goTo = (idx) => {
    clearErrors();
    setPg(idx);
    setVisited(v => new Set([...v, idx]));
  };

  const u = (data) => setDData(data);
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

  function renderEpaHealth(px, clientName) {
    const epaVal = dData[`${px}EpaHealth`];
    const attD = { count: parseInt(dData[`${px}HealthAttCount`] || 0), list: dData[`${px}HealthAtts`] || [] };
    const started = (epaVal || '').startsWith('Yes');
    return (
      <>
        <SectionHeader icon="🏥" title={`${clientName} — Enduring Power of Attorney: Health & Personal`} />
        <InfoBox>An Enduring Power of Attorney (Health & Personal) appoints someone to make health, medical, and personal decisions on your behalf if you lose capacity.</InfoBox>
        <Field label={`EPA for health & personal decisions (${clientName})`} type="radio"
          opts={['Yes — I wish to make a new EPA', 'Yes — I wish to update an existing EPA', 'No — I do not wish to make one at this time', 'To discuss']}
          value={epaVal} onChange={v => u({ ...dData, [`${px}EpaHealth`]: v })} required error={ge(`${px}EpaHealth`)} />
        {started && (
          <PersonList countLabel="Number of health attorneys" D={attD}
            update={v => u({ ...dData, [`${px}HealthAttCount`]: String(v.count), [`${px}HealthAtts`]: v.list })}
            noun="Health Attorney" nounKey={`${px}_health_att`} showAgreed showAddr
            countError={ge(`${px}HealthAttCount`) || ge(`${px}HealthAttCount_min`)} getError={ge} />
        )}
      </>
    );
  }

  function renderMedical(px, clientName) {
    return (
      <>
        <SectionHeader icon="💊" title={`${clientName} — Medical & End of Life Wishes`} />
        <SectionLabel text="Advance Health Directive" />
        <Field label="Do you wish to make an Advance Health Directive (AHD)?" type="radio"
          opts={['Yes — I wish to make one', 'No', 'To discuss']}
          value={dData[`${px}Ahd`]} onChange={v => u({ ...dData, [`${px}Ahd`]: v })} required error={ge(`${px}Ahd`)} />
        <SectionLabel text="Life-Sustaining Treatment" />
        <Field label="Regarding life-sustaining treatment (in cases of terminal illness or permanent unconsciousness)" type="radio"
          opts={[
            'I wish all reasonable treatment to be provided',
            'I wish treatment to be withdrawn if there is no reasonable chance of recovery',
            'I wish to discuss this with my attorney and medical team',
            'To discuss with my solicitor',
          ]}
          value={dData[`${px}LifeSustaining`]} onChange={v => u({ ...dData, [`${px}LifeSustaining`]: v })} required error={ge(`${px}LifeSustaining`)} />
        <SectionLabel text="Organ Donation" />
        <Field label="Organ donation wishes" type="radio"
          opts={[
            'I consent to donation of any/all organs and tissue',
            'I consent to donation of specific organs only (please specify in additional info)',
            'I do not consent to organ donation',
            'To discuss / no decision at this time',
          ]}
          value={dData[`${px}OrganDonation`]} onChange={v => u({ ...dData, [`${px}OrganDonation`]: v })} required error={ge(`${px}OrganDonation`)} />
      </>
    );
  }

  function renderEpaFin(px, clientName) {
    const epaVal = dData[`${px}EpaFin`];
    const attD = { count: parseInt(dData[`${px}FinAttCount`] || 0), list: dData[`${px}FinAtts`] || [] };
    const started = (epaVal || '').startsWith('Yes');
    return (
      <>
        <SectionHeader icon="💰" title={`${clientName} — Enduring Power of Attorney: Financial`} />
        <InfoBox>An Enduring Power of Attorney (Financial) appoints someone to manage your financial affairs if you lose capacity.</InfoBox>
        <Field label={`EPA for financial decisions (${clientName})`} type="radio"
          opts={['Yes — I wish to make a new EPA', 'Yes — I wish to update an existing EPA', 'No — I do not wish to make one at this time', 'To discuss']}
          value={epaVal} onChange={v => u({ ...dData, [`${px}EpaFin`]: v })} required error={ge(`${px}EpaFin`)} />
        {started && (
          <>
            <Field label="When does the EPA take effect?" type="radio"
              opts={['Immediately upon signing', 'Only if I lose capacity (as certified by a doctor)', 'To discuss']}
              value={dData[`${px}EpaFinTrigger`]} onChange={v => u({ ...dData, [`${px}EpaFinTrigger`]: v })} required error={ge(`${px}EpaFinTrigger`)} />
            <PersonList countLabel="Number of financial attorneys" D={attD}
              update={v => u({ ...dData, [`${px}FinAttCount`]: String(v.count), [`${px}FinAtts`]: v.list })}
              noun="Financial Attorney" nounKey={`${px}_fin_att`} showAgreed showAddr
              countError={ge(`${px}FinAttCount`) || ge(`${px}FinAttCount_min`)} getError={ge} />
          </>
        )}
      </>
    );
  }

  function renderFuneral(px, clientName) {
    return (
      <>
        <SectionHeader icon="🕊" title={`${clientName} — Funeral & Legacy Wishes`} />
        <InfoBox>While funeral wishes are not legally binding, they provide important guidance to your loved ones and executor.</InfoBox>
        <Field label="Burial / Cremation preference" type="radio" opts={['Burial', 'Cremation', 'No preference', 'To discuss']}
          value={dData[`${px}BurialPref`]} onChange={v => u({ ...dData, [`${px}BurialPref`]: v })} required error={ge(`${px}BurialPref`)} />
        <Field label="Religious or cultural observances (if any)" type="textarea" rows={2}
          value={dData[`${px}FuneralReligion`]} onChange={v => u({ ...dData, [`${px}FuneralReligion`]: v })} required
          placeholder="Enter details, or type 'None' if not applicable"
          error={ge(`${px}FuneralReligion`)} />
        <Field label="Legacy wishes / messages to loved ones" type="textarea" rows={3}
          value={dData[`${px}Legacy`]} onChange={v => u({ ...dData, [`${px}Legacy`]: v })} required
          placeholder="Enter details, or type 'None' if not applicable"
          error={ge(`${px}Legacy`)} />
      </>
    );
  }

  function renderPage() {
    const key = allPages[safePg]?.key;
    switch (key) {
      case 'welcome_d': return (
        <>
          <SectionHeader icon="📋" title="Part D — Enduring Power of Attorney, Medical Wishes & Funeral Directions" />
          <AdviceBox title="Difference between a Will and an Enduring Power of Attorney" defaultOpen>
            <p><strong>Your Will</strong> only takes effect after your death.</p>
            <p><strong>An Enduring Power of Attorney (EPA)</strong> operates during your lifetime when you have lost capacity. Without an EPA, your family may need to apply to a court or tribunal — which is costly and time-consuming.</p>
          </AdviceBox>
        </>
      );
      case 'c1epahealth': return renderEpaHealth('c1', n1);
      case 'c1medical':   return renderMedical('c1', n1);
      case 'c1epafin':    return renderEpaFin('c1', n1);
      case 'c1funeral':   return renderFuneral('c1', n1);
      case 'c2epahealth': return renderEpaHealth('c2', n2);
      case 'c2medical':   return renderMedical('c2', n2);
      case 'c2epafin':    return renderEpaFin('c2', n2);
      case 'c2funeral':   return renderFuneral('c2', n2);

      case 'additional': return (
        <>
          <SectionHeader icon="ℹ️" title="Additional Information" />
          <Field label={`Is ${n1} currently involved in any litigation, dispute, or legal proceedings?`}
            type="radio" opts={['Yes', 'No']}
            value={dData.c1Litigation} onChange={v => u({ ...dData, c1Litigation: v })} required error={ge('c1Litigation')} />
          <Field label="Is there anything else you would like us to know or consider?" type="textarea" rows={4}
            value={dData.c1AdditionalInfo} onChange={v => u({ ...dData, c1AdditionalInfo: v })} required
            placeholder="Enter details, or type 'None' if not applicable"
            error={ge('c1AdditionalInfo')} />
        </>
      );

      case 'declaration': return (
        <>
          <SectionHeader icon="✍️" title="Declaration" />
          <InfoBox>
            <strong>Declaration by Client(s)</strong>
            <p style={{ margin: '8px 0 0', lineHeight: 1.7 }}>
              I/We declare that the information provided in this questionnaire is true and correct to the best of my/our knowledge and belief. I/We understand that this information will be used by St Ives Law to prepare my/our estate planning documents and does not constitute legal advice.
            </p>
            <p style={{ margin: '8px 0 0' }}>
              I/We consent to the collection, storage, and use of this information in accordance with St Ives Law's privacy policy.
            </p>
          </InfoBox>
          <SectionLabel text={n1} />
          <Field label={`Declaration Date (${n1})`} type="date" value={dData.c1SignDate}
            onChange={v => u({ ...dData, c1SignDate: v })} required error={ge('c1SignDate')} />
          {isCouple && (
            <>
              <SectionLabel text={n2} />
              <Field label={`Declaration Date (${n2})`} type="date" value={dData.c2SignDate}
                onChange={v => u({ ...dData, c2SignDate: v })} required error={ge('c2SignDate')} />
            </>
          )}
        </>
      );

      case 'submit': return (
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ background: C.greenL, border: `1px solid ${C.green}`, borderRadius: 8, padding: '28px 32px', display: 'inline-block', maxWidth: 480, textAlign: 'left' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🎉</div>
            <h3 style={{ fontFamily: C.fontHeading, color: C.green, margin: '0 0 10px', fontWeight: 'normal', fontSize: 20 }}>All Parts Complete!</h3>
            <p style={{ fontFamily: C.fontBody, fontSize: 14, color: C.text, margin: 0, lineHeight: 1.6 }}>
              You have completed all four parts of the questionnaire. Click <strong>Submit Questionnaire</strong> to send your information to St Ives Law.
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
    isSubmitPage: allPages[safePg]?.key === 'submit',
    errors, hasError, getError, clearErrors,
  };
}
