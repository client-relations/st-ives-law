import { C } from '../constants/colors.js';
import { RELATIONSHIP_OPTIONS } from '../constants/relationshipOptions.js';
import Field from './Field.jsx';
import SectionLabel from './SectionLabel.jsx';

function newGift() {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    bFirst: '', bLast: '', bAddr: '', bRel: '', desc: '', hasSub: '', subDesc: '',
  };
}

function newResBene() {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    first: '', last: '', addr: '', rel: '', pct: '', tt: '',
  };
}

export default function DistributionScenario({ D, update, prefix, scenLabel, getError }) {
  const ge = getError || (() => null);
  const gifts = D.gifts || [];
  const resBenes = D.resBenes || [];
  const giftCount = parseInt(D.giftCount || 0);
  const resBeneCount = parseInt(D.resBeneCount || 0);

  const updateGift = (idx, key, val) => {
    const newGifts = gifts.map((g, i) => i === idx ? { ...g, [key]: val } : g);
    update({ ...D, gifts: newGifts });
  };

  const setGiftCount = (n) => {
    const count = Math.max(0, Math.min(20, parseInt(n, 10) || 0));
    let arr = [...gifts];
    while (arr.length < count) arr.push(newGift());
    arr = arr.slice(0, count);
    update({ ...D, giftCount: count, gifts: arr });
  };

  const updateResBene = (idx, key, val) => {
    const newRes = resBenes.map((r, i) => i === idx ? { ...r, [key]: val } : r);
    update({ ...D, resBenes: newRes });
  };

  const setResBeneCount = (n) => {
    const raw = n === '' ? '' : String(Math.max(0, Math.min(20, parseInt(n, 10) || 0)));
    const count = parseInt(raw || 0);
    let arr = [...resBenes];
    while (arr.length < count) arr.push(newResBene());
    arr = arr.slice(0, count);
    update({ ...D, resBeneCount: raw, resBenes: arr });
  };

  const pctTotal = resBenes.slice(0, resBeneCount).reduce((sum, b) => sum + (parseFloat(b.pct) || 0), 0);
  const pctOk = resBeneCount === 0 || Math.abs(pctTotal - 100) < 0.01;

  const cardStyle = {
    border: `1px solid ${C.bgBorder}`, borderRadius: 6,
    padding: '14px 16px', marginBottom: 12, background: C.bg,
  };

  return (
    <div>
      {scenLabel && (
        <div style={{ background: C.slatePale, border: `1px solid ${C.slateL}`, borderRadius: 5, padding: '8px 14px', marginBottom: 16, fontFamily: C.fontBody, fontSize: 13, color: C.teal, fontWeight: 600 }}>
          Scenario: {scenLabel}
        </div>
      )}

      <SectionLabel text="Specific Gifts" />
      <Field label="Are there any specific gifts?" type="radio" opts={['Yes', 'No']}
        value={D.hasGifts} onChange={v => update({ ...D, hasGifts: v })}
        required error={ge(`${prefix}.hasGifts`)} />

      {D.hasGifts === 'Yes' && (
        <>
          <Field label="Number of specific gifts" type="number" value={D.giftCount || ''}
            onChange={setGiftCount} required error={ge(`${prefix}.giftCount`)} />
          {gifts.slice(0, giftCount).map((gift, idx) => (
            <div key={gift.id} style={cardStyle}>
              <SectionLabel text={`Gift ${idx + 1} — Beneficiary`} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0 16px' }}>
                <Field label="First Name" value={gift.bFirst} onChange={v => updateGift(idx, 'bFirst', v)} required
                  error={ge(`${prefix}_gift_${idx}_bFirst`)} />
                <Field label="Last Name" value={gift.bLast} onChange={v => updateGift(idx, 'bLast', v)} required
                  error={ge(`${prefix}_gift_${idx}_bLast`)} />
                <Field label="Relationship" type="select" opts={RELATIONSHIP_OPTIONS}
                  value={gift.bRel} onChange={v => updateGift(idx, 'bRel', v)} required
                  error={ge(`${prefix}_gift_${idx}_bRel`)} />
              </div>
              <Field label="Address" value={gift.bAddr} onChange={v => updateGift(idx, 'bAddr', v)} required
                error={ge(`${prefix}_gift_${idx}_bAddr`)} />
              <Field label="Description of gift" type="textarea" rows={2} value={gift.desc}
                onChange={v => updateGift(idx, 'desc', v)} required
                error={ge(`${prefix}_gift_${idx}_desc`)} />
              <Field label="If this gift no longer exists, is there a substitute?" type="radio" opts={['Yes', 'No']}
                value={gift.hasSub} onChange={v => updateGift(idx, 'hasSub', v)} required
                error={ge(`${prefix}_gift_${idx}_hasSub`)} />
              {gift.hasSub === 'Yes' && (
                <Field label="Describe the substitute" type="textarea" rows={2} value={gift.subDesc}
                  onChange={v => updateGift(idx, 'subDesc', v)} required
                  placeholder="Enter details, or type 'None' if not applicable"
                  error={ge(`${prefix}_gift_${idx}_subDesc`)} />
              )}
            </div>
          ))}
        </>
      )}

      <SectionLabel text="Residuary Estate" />
      <Field label="Number of residuary beneficiaries" type="number" value={D.resBeneCount ?? ''}
        onChange={setResBeneCount} required error={ge(`${prefix}.resBeneCount`)} />

      {resBenes.slice(0, resBeneCount).map((res, idx) => (
        <div key={res.id} style={cardStyle}>
          <SectionLabel text={`Residuary Beneficiary ${idx + 1}`} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0 16px' }}>
            <Field label="First Name" value={res.first} onChange={v => updateResBene(idx, 'first', v)} required
              error={ge(`${prefix}_resbene_${idx}_first`)} />
            <Field label="Last Name" value={res.last} onChange={v => updateResBene(idx, 'last', v)} required
              error={ge(`${prefix}_resbene_${idx}_last`)} />
            <Field label="Relationship" type="select" opts={RELATIONSHIP_OPTIONS}
              value={res.rel} onChange={v => updateResBene(idx, 'rel', v)} required
              error={ge(`${prefix}_resbene_${idx}_rel`)} />
            <Field label="% of Residue" type="number" value={res.pct}
              onChange={v => updateResBene(idx, 'pct', v)} placeholder="e.g. 50" required
              error={ge(`${prefix}_resbene_${idx}_pct`)} />
            <Field label="Would you like protection for their inheritance in the form of a trust?" type="select"
              opts={['Yes', 'No', 'To discuss']}
              value={res.tt} onChange={v => updateResBene(idx, 'tt', v)}
              error={ge(`${prefix}_resbene_${idx}_tt`)} />
          </div>
          <Field label="Address" value={res.addr} onChange={v => updateResBene(idx, 'addr', v)} required
            error={ge(`${prefix}_resbene_${idx}_addr`)} />
        </div>
      ))}

      {resBeneCount > 0 && (
        <div style={{
          padding: '8px 12px', borderRadius: 5, marginTop: 4,
          background: pctOk ? '#f0fff4' : '#fff0f0',
          border: `1px solid ${pctOk ? C.green : C.red}`,
          fontFamily: C.fontBody, fontSize: 13,
          color: pctOk ? C.green : C.red, fontWeight: 600,
        }}>
          {pctOk ? `✓ Percentages total 100%` : `⚠ Percentages total ${pctTotal.toFixed(1)}% — must equal 100%`}
        </div>
      )}
    </div>
  );
}
