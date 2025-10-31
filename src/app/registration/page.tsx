'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

const PRICE: Record<MockKey, number> = { 'du-iba': 3000, 'bup-iba': 2200, 'du-fbs': 2500, 'bup-fbs': 2000, 'fbs-crash': 6500 };
const COUNT: Partial<Record<MockKey, number>> = { 'du-iba': 10, 'du-fbs': 8 };
type Education = 'hsc' | 'alevels';
type Mode = 'mocks' | 'full';
type MockKey = 'du-iba' | 'bup-iba' | 'du-fbs' | 'bup-fbs' | 'fbs-crash';
type FullKey = 'du-iba-full' | 'bup-iba-full' | 'bup-fbs-full';

export default function RegistrationPage() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [edu, setEdu] = useState<Education | null>(null);
  const [years, setYears] = useState({ hsc: '', ssc: '', a: '', o: '' });
  const [mode, setMode] = useState<Mode | null>(null);
  const [mocks, setMocks] = useState<MockKey[]>([]);
  const [full, setFull] = useState<FullKey[]>([]);
  const [intent, setIntent] = useState<'trial' | 'full' | null>(null);
  const isHSC = edu === 'hsc';

  const mocksEff = useMemo(() => (mocks.includes('fbs-crash') ? mocks.filter(m => m !== 'du-fbs' && m !== 'bup-fbs') : mocks), [mocks]);
  const subtotal = useMemo(() => mocksEff.reduce((s, k) => s + PRICE[k], 0), [mocksEff]);
  const disc = useMemo(() => { const n = mocksEff.length; return n>=4?0.25:n===3?0.15:n===2?0.05:0; }, [mocksEff]);
  const total = useMemo(() => Math.round(subtotal * (1 - disc)), [subtotal, disc]);

  const can1 = name.trim() && /@/.test(email) && phone.trim();
  const can2 = !!edu && ((edu==='hsc' && years.hsc && years.ssc) || (edu==='alevels' && years.a && years.o));
  const can3 = (mode==='mocks' && mocksEff.length>0 && intent) || (mode==='full' && full.length>0);

    function toggleMock(k: MockKey) {
    setIntent(null);
    setMocks(prev => {
      let next = prev.includes(k) ? prev.filter(x=>x!==k) : [...prev, k];
      if (next.includes('fbs-crash')) next = next.filter(x => x!=='du-fbs' && x!=='bup-fbs');
      if (k==='du-fbs' || k==='bup-fbs') next = next.filter(x => x!=='fbs-crash');
      return next;
    });
  }

  function toggleFull(k: FullKey) {
    setFull(prev => prev.includes(k) ? prev.filter(x=>x!==k) : [...prev, k]);
  }

  async function submitRegistration() {
    const payload: any = {
      name, email, phone,
      track: edu!,
      years,
      mode: mode!,
    };
    if (mode === 'mocks') {
      payload.mocks = mocksEff;
      payload.intent = intent;
      payload.totalPrice = total;
    } else if (mode === 'full') {
      payload.full = full;
    }
    const res = await fetch('/api/registrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) {
      alert('Registration submitted successfully.');
    } else {
      alert('Failed to submit registration. Please try again.');
    }
  }return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-vh-beige/5">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-3xl md:text-4xl font-black text-gray-900">Registration</h1>
        <p className="text-gray-600 mb-4">Premium enrolment in a few steps.</p>
        <div className="text-sm text-gray-600 mb-4">Step {step} of 4</div>
        <div className="bg-white border rounded-2xl p-6 shadow">
          {step===1 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold">Full name</label>
                <input className="w-full border rounded px-3 py-2 mt-1" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold">Email</label>
                  <input className="w-full border rounded px-3 py-2 mt-1" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/>
                </div>
                <div>
                  <label className="text-sm font-semibold">Phone</label>
                  <input className="w-full border rounded px-3 py-2 mt-1" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="01XXXXXXXXX"/>
                </div>
              </div>
              <div className="flex justify-end">
                <button disabled={!can1} onClick={()=>setStep(2)} className="px-5 py-2 rounded bg-vh-red text-white disabled:bg-gray-300">Continue</button>
              </div>
            </div>
          )}
          {step===2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button onClick={()=>setEdu('hsc')} className={(edu==='hsc'? 'border-vh-red bg-vh-red/5 ': '') + 'border rounded p-3 text-left'}>
                  HSC Track
                  <br/>
                  <span className="text-xs text-gray-600">SSC ? HSC</span>
                </button>
                <button onClick={()=>setEdu('alevels')} className={(edu==='alevels'? 'border-vh-red bg-vh-red/5 ': '') + 'border rounded p-3 text-left'}>
                  A Levels Track
                  <br/>
                  <span className="text-xs text-gray-600">O ? A</span>
                </button>
              </div>
              {edu==='hsc' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold">HSC Year</label>
                    <input className="w-full border rounded px-3 py-2 mt-1" value={years.hsc} onChange={e=>setYears({...years,hsc:e.target.value})}/>
                  </div>
                  <div>
                    <label className="text-sm font-semibold">SSC Year</label>
                    <input className="w-full border rounded px-3 py-2 mt-1" value={years.ssc} onChange={e=>setYears({...years,ssc:e.target.value})}/>
                  </div>
                </div>
              )}
              {edu==='alevels' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold">A Level Year</label>
                    <input className="w-full border rounded px-3 py-2 mt-1" value={years.a} onChange={e=>setYears({...years,a:e.target.value})}/>
                  </div>
                  <div>
                    <label className="text-sm font-semibold">O Level Year</label>
                    <input className="w-full border rounded px-3 py-2 mt-1" value={years.o} onChange={e=>setYears({...years,o:e.target.value})}/>
                  </div>
                </div>
              )}
              <div className="flex justify-between">
                <button onClick={()=>setStep(1)} className="px-5 py-2 rounded border">Back</button>
                <button disabled={!can2} onClick={()=>setStep(3)} className="px-5 py-2 rounded bg-vh-red text-white disabled:bg-gray-300">Continue</button>
              </div>
            </div>
          )}
          {step===3 && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <button onClick={()=>{setMode('mocks'); setFull([]);}} className={(mode==='mocks'? 'border-vh-red bg-vh-red/5 ': '') + 'border rounded p-3 text-left'}>
                  Mock Programs
                  <br/>
                  <span className="text-xs text-gray-600">First mock is free</span>
                </button>
                <button onClick={()=>{setMode('full'); setMocks([]); setIntent(null);}} className={(mode==='full'? 'border-vh-red bg-vh-red/5 ': '') + 'border rounded p-3 text-left'}>
                  Full Courses
                  <br/>
                  <span className="text-xs text-gray-600">Complete preparation</span>
                </button>
              </div>

              {mode==='mocks' && (
                <div className="space-y-3">
                  <Option title="DU IBA Mocks" note={(COUNT['du-iba']||'') + (COUNT['du-iba']? ' mocks � ': '') + 'First mock free'} price={PRICE['du-iba']} checked={mocksEff.includes('du-iba')} onToggle={()=>toggleMock('du-iba')}/>
                  <Option title="BUP IBA Mocks" note="First mock free" price={PRICE['bup-iba']} checked={mocksEff.includes('bup-iba')} onToggle={()=>toggleMock('bup-iba')}/>
                  {!isHSC && (<Option title="DU FBS Mocks" note={(COUNT['du-fbs']||'') + (COUNT['du-fbs']? ' mocks � ': '') + 'First mock free'} price={PRICE['du-fbs']} checked={mocksEff.includes('du-fbs')} onToggle={()=>toggleMock('du-fbs')}/>)}
                  {!isHSC && (<Option title="BUP FBS Mocks" note="First mock free" price={PRICE['bup-fbs']} checked={mocksEff.includes('bup-fbs')} onToggle={()=>toggleMock('bup-fbs')}/>)}
                  {!isHSC && (<Option title="DU + BUP FBS Crash Course" note="Includes notes, classes, instructor guidance + DU FBS and BUP FBS mocks" price={PRICE['fbs-crash']} checked={mocksEff.includes('fbs-crash')} onToggle={()=>toggleMock('fbs-crash')}/>)}
                  <div className="border rounded p-3 text-sm">Selected: {mocksEff.length} � Discount: {disc*100}% � Total: Tk {total.toLocaleString('en-US')}</div>
                  {mocksEff.length>0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <button onClick={()=>setIntent('trial')} className="border rounded p-3 text-left">Begin with the complimentary first mock<br/><span className="text-xs text-gray-600">Register now�decide later (no payment required)</span></button>
                      <button onClick={()=>setIntent('full')} className="border rounded p-3 text-left">Secure your place for the full program<br/><span className="text-xs text-gray-600">Reserve your spot�premium preparation (no payment required)</span></button>
                    </div>
                  )}
                </div>
              )}

              {mode==='full' && (
                <div className="space-y-3">
                  <Option title="DU IBA (Full Course)" checked={full.includes('du-iba-full')} onToggle={()=>toggleFull('du-iba-full')}/>
                  <Option title="BUP IBA (Full Course)" checked={full.includes('bup-iba-full')} onToggle={()=>toggleFull('bup-iba-full')}/>
                  {!isHSC && (<Option title="BUP FBS (Full Course)" checked={full.includes('bup-fbs-full')} onToggle={()=>toggleFull('bup-fbs-full')}/>)}
                  <div className="border rounded p-3 text-sm">Select one or more full courses. Our team will contact you with next steps.</div>
                </div>
              )}

              <div className="flex justify-between">
                <button onClick={()=>setStep(2)} className="px-5 py-2 rounded border">Back</button>
                <button disabled={!can3} onClick={()=>setStep(4)} className="px-5 py-2 rounded bg-vh-red text-white disabled:bg-gray-300">Continue</button>
              </div>
            </div>
          )}
          {step===4 && (
            <div className="space-y-4">
              <div className="border rounded p-4 bg-gray-50">
                <div className="font-bold">Summary</div>
                <div className="text-sm">{name} � {email} � {phone}</div>
                <div className="text-sm">Track: {edu==='hsc' ? 'HSC (SSC ? HSC)' : 'A Levels (O ? A)'}; Years: {edu==='hsc' ? `SSC ${years.ssc}, HSC ${years.hsc}` : `O ${years.o}, A ${years.a}`}</div>
                {mode==='mocks' ? (
                  <div className="text-sm">Mocks: {mocksEff.join(', ')} � Total Tk {total.toLocaleString('en-US')} ({disc*100}% off)</div>
                ) : (
                  <div className="text-sm">Full: {full.join(', ')}</div>
                )}
              </div>
              {mode==='full' && (
                <div className="border rounded p-4 bg-green-50 text-green-800">Thank you for registering. Our team will contact you shortly with next steps and scheduling.</div>
              )}
              {mode==='mocks' && (
                <div className="border rounded p-4 bg-vh-red/5">
                  Join our WhatsApp community for announcements and support. You may register now to try the first mock�no payment required.
                  <br/>
                  <Link className="inline-block mt-3 px-4 py-2 rounded bg-vh-red text-white" href="https://chat.whatsapp.com/LBdtaxyUP6w1S7npTrFli6" target="_blank">Join WhatsApp Community</Link>
                </div>
              )}
              <div className="flex justify-between">
                <button onClick={()=>setStep(3)} className="px-5 py-2 rounded border">Back</button>
                <div className="flex gap-3"><button onClick={submitRegistration} className="px-5 py-2 rounded bg-vh-red text-white">Submit Registration</button><Link href="/" className="px-5 py-2 rounded bg-gray-900 text-white">Home</Link></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Option({ title, note, price, checked, onToggle }: { title: string; note?: string; price?: number; checked: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="w-full border rounded p-3 text-left flex items-center justify-between">
      <div>
        <div className="font-semibold">{title}</div>
        {note && <div className="text-xs text-gray-600">{note}</div>}
      </div>
      <div className="text-right">
        {typeof price==='number' ? <div className="font-bold">Tk {price.toLocaleString('en-US')}</div> : <div className="text-xs text-gray-500">Details on request</div>}
        <div className="text-xs">{checked ? 'Selected' : 'Tap to select'}</div>
      </div>
    </button>
  );
}







